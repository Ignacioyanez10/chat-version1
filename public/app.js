// Importamos Firebase desde sus servidores oficiales
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// === CONFIGURACIÓN DE FIREBASE === 
// (Debes crear un proyecto en Firebase y pegar aquí tus datos)
const firebaseConfig = {
  apiKey: "AIzaSyACCTFwvv_YW_FGtM79RTyxvkYaSoTNaQ8",
  authDomain: "michatrailway.firebaseapp.com",
  projectId: "michatrailway",
  storageBucket: "michatrailway.firebasestorage.app",
  messagingSenderId: "196948202044",
  appId: "1:196948202044:web:cb34c2a8ce46993ed76939"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === VARIABLES GLOBALES ===
const socket = io(); // Conecta con nuestro servidor local (localhost:3000)
let username = "";
let currentRoom = "General";
let localMessages = []; // Para buscar en el cliente (Req 8)
let lastVisibleDoc = null; // Para el scroll infinito (Req 9)
const soundSend = new Audio('/sounds/notificacion.mp3');
const soundReceive = new Audio('/sounds/notificacion.mp3');


// Sonido para notificaciones (Req 7)
const audioNotificacion = new Audio('/sounds/notificacion.mp3');

// === INGRESO DE USUARIO (Req 5) ===
window.joinApp = () => {
    const nameInput = document.getElementById('username-input').value.trim();
    if (nameInput) {
        username = nameInput;
        document.getElementById('login-screen').style.display = 'none';
        switchRoom('General');
    } else {
        alert('Por favor, ingresa un nombre para continuar.');
    }
};

// === CAMBIAR DE SALA (Modificado con manejo de errores) ===
window.switchRoom = async (roomName) => {
    currentRoom = roomName;
    document.getElementById('current-room-title').innerText = `Sala: ${currentRoom}`;

    window.showSidebar(false);

    document.querySelector('.chat-container').setAttribute('data-room', currentRoom);
    document.getElementById('current-room-title').innerText = `Sala: ${currentRoom}`;
    
    // Limpiamos la pantalla dejando el ancla del scroll
    document.getElementById('messages-container').innerHTML = '<div id="scroll-anchor"></div><div id="loading-more">Cargando...</div>';
    
    // Notificamos al servidor local
    socket.emit('joinRoom', { username, room: currentRoom });
    
    // Reiniciamos el historial local
    localMessages = [];
    lastVisibleDoc = null;
    
    // Intentamos cargar el historial
    await loadMessagesFromFirebase();
};


// === ENVIAR MENSAJES TEXTO (Req 6) ===
window.sendMessage = async () => {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (text === "") return; // Si está vacío, no hace nada

    // 1. Preparamos el paquete de datos con la información del mensaje
    const messageData = {
        username: username,
        room: currentRoom,
        text: text,
        type: 'text',
        timestamp: serverTimestamp() // Hora de Firebase
    };

    input.value = ''; // Limpiamos la caja de texto inmediatamente

    try {
        // 2. Intentamos guardarlo en la base de datos de Firebase
        await addDoc(collection(db, "messages"), messageData);
        
        // 3. Si Firebase lo guardó bien, lo esparcimos a los demás con Socket.IO
        socket.emit('chatMessage', messageData);
        
        // 🚀 ¡AQUÍ VA EL SONIDO!
        // Como todo salió bien, disparamos el efecto de envío
        soundSend.play().catch(err => console.log("Sonido bloqueado por el navegador:", err));

    } catch (error) {
        console.error("Error al enviar mensaje:", error);
    }
};

// Insertar Emoji rápido (Req 6)
window.insertEmoji = (emoji) => {
    const input = document.getElementById('message-input');
    input.value += emoji;
    input.focus();
};

// === ENVIAR ARCHIVOS (Req 6) ===
window.sendFile = async () => {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Foto ligera

            const messageData = {
                username: username,
                room: currentRoom,
                text: 'Ha enviado una imagen',
                type: 'image',
                fileUrl: dataUrl,
                timestamp: serverTimestamp()
            };

            // 1. Guardamos la imagen comprimida en Firestore
            addDoc(collection(db, "messages"), messageData)
                .then(() => {
                    // 2. Si se guardó, la enviamos por Socket.IO para que aparezca en las pantallas
                    socket.emit('chatMessage', messageData);
                    
                    // 🚀 ¡AQUÍ VA EL SONIDO!
                    // Disparamos el sonido de envío también para las fotos
                    soundSend.play().catch(err => console.log("Sonido bloqueado:", err));
                })
                .catch(err => console.error("Error al guardar foto:", err));
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
};

// === RECIBIR MENSAJES Y NOTIFICACIONES (Req 2 y 7) ===
socket.on('message', (data) => {
    renderMessage(data, true);
    localMessages.push(data); // Lo añadimos al historial local para la búsqueda
    
    // Aseguramos que existan los nombres para evitar errores en la consola
    if (data && data.username && username) {
        // Limpiamos espacios en blanco y pasamos todo a minúsculas antes de comparar
        const remitente = data.username.trim().toLowerCase();
        const yoMismo = username.trim().toLowerCase();

        // Reproducir sonido si el mensaje es de otra persona
        if (remitente !== yoMismo) {
            audioNotificacion.play().catch(() => console.log("Sonido bloqueado por el navegador"));
        }
    }
});

socket.on('notification', (text) => {
    Toastify({
        text: text,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: { background: "#128c7e" }
    }).showToast();
});

// Función para pintar el mensaje en la pantalla HTML
function renderMessage(data, appendAtBottom = true) {
    const container = document.getElementById('messages-container');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    if (data.username === username) msgDiv.classList.add('mine');

    let content = "";

    if (data.type === 'image') {
        // Para imágenes: Nombre arriba y la foto abajo
        content = `<strong>${data.username}</strong>
                   <img src="${data.fileUrl}" style="max-width: 200px; border-radius: 8px; margin-top: 5px;">`;
    } else {
        // Para texto: Nombre en negrita, un espacio y el texto (SIN DOS PUNTOS)
        content = `<strong>${data.username}</strong> ${data.text}`;
    }
    
    msgDiv.innerHTML = content;

    if (appendAtBottom) {
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    } else {
        const anchor = document.getElementById('scroll-anchor');
        container.insertBefore(msgDiv, anchor.nextSibling);
    }
}

// === HISTORIAL CON SCROLL INFINITO ===
async function loadMessagesFromFirebase() {
    try {
        const messagesRef = collection(db, "messages");
        let q;

        // Armamos la consulta según si ya tenemos mensajes cargados o no
        if (lastVisibleDoc) {
            q = query(messagesRef, where("room", "==", currentRoom), orderBy("timestamp", "desc"), startAfter(lastVisibleDoc), limit(15));
        } else {
            q = query(messagesRef, where("room", "==", currentRoom), orderBy("timestamp", "desc"), limit(15));
        }

        console.log(`[Firebase] Intentando leer mensajes de la sala: ${currentRoom}`);
        const querySnapshot = await getDocs(q);
        console.log(`[Firebase] Mensajes encontrados en esta tanda: ${querySnapshot.size}`);

        if (!querySnapshot.empty) {
            // Guardamos el último documento para el scroll infinito
            lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            const docs = querySnapshot.docs;
            
            // Los pintamos de forma inversa (los más viejos arriba)
            for (let i = 0; i < docs.length; i++) {
                const data = docs[i].data();
                renderMessage(data, false); // false para que se inserten arriba en el historial
                
                // 🚀 CAMBIO AQUÍ: Usamos unshift en lugar de push.
                // Como Firebase los trae del más nuevo al más viejo, con unshift() los colocamos
                // al inicio del array. Así localMessages se ordena naturalmente de viejo a nuevo.
                localMessages.unshift(data); 
            }
        } else {
            console.log("[Firebase] No hay mensajes previos en esta sala.");
        }
    } catch (error) {
        console.error("❌ ERROR CRÍTICO AL LEER DE FIREBASE:", error);
        alert("Firestore no pudo leer los mensajes. Abre la consola (F12) para ver el enlace de activación.");
    }
}
// Intersection Observer: detecta cuando llegamos arriba del todo
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && username !== "") {
        document.getElementById('loading-more').style.display = 'block';
        loadMessagesFromFirebase().then(() => {
            document.getElementById('loading-more').style.display = 'none';
        });
    }
});
window.onload = () => {
    observer.observe(document.getElementById('scroll-anchor'));
};

// === BUSCADOR EN EL HISTORIAL CLIENTE (Req 8) ===
window.searchMessages = () => {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const container = document.getElementById('messages-container');
    
    // Eliminamos los mensajes de la vista actual sin tocar el loading ni el scroll-anchor
    container.querySelectorAll('.message').forEach(msg => msg.remove());

    // Si el buscador está vacío, volvemos a pintar todo el historial limpio
    if (searchTerm === "") {
        localMessages.forEach(data => renderMessage(data, true));
        return;
    }

    // Filtramos localmente por texto o usuario
    const filtered = localMessages.filter(msg => 
        (msg.text && msg.text.toLowerCase().includes(searchTerm)) || 
        (msg.username && msg.username.toLowerCase().includes(searchTerm))
    );
    
    // Los mostramos ordenados directamente tal y como están guardados
    filtered.forEach(data => renderMessage(data, true));
};


window.showSidebar = (show) => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if (show) {
            sidebar.classList.remove('hidden'); // Muestra las salas
        } else {
            sidebar.classList.add('hidden');    // Oculta las salas (muestra el chat)
        }
    }
};