const socket = io();

const form = document.getElementById('form-container');
const input = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');
let miNombre = '';


// utilizar la libreria SweetAlert para solicitar el nombre del usuario
Swal.fire({
    title: 'Bienvenido al chat',
    input: 'text',
    inputLabel: 'Por favor, ingresa tu nombre',
    inputPlaceholder: 'Tu nombre',
    allowOutsideClick: false,
    confirmButtonText: 'Ingresar',
    confirmButtonColor: '#007aff',
    inputValidator: (value) => {
        if (!value) {
            return 'Por favor, ingresa tu nombre';
        }
    }
}).then((result) => {
    if (result.isConfirmed) {
        miNombre = result.value;
        socket.emit('nuevoUsuario', miNombre);
    }

});

//manejar el evento de envío del formulario
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        socket.emit('mensaje-chat', input.value);
        input.value = '';
    }
});

//recibir mensajes del servidor
socket.on('mensaje-chat', (data) => {   
    const div = document.createElement('div');
    
    //diferenciar quien envio el mensaje
    div.classList.add('mensaje');
    if (data.usuario === miNombre) {
        div.classList.add('propio');
    }

    div.innerHTML=`
        <span class="autor">${data.usuario}</span>
        ${data.mensaje}
        <span class="hora">${data.hora}</span>

    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight; //autoscroll hacia el ultimo mensaje
});

//recibir notificaciones de nuevos usuarios
socket.on('mensaje-sistema', (msg) => {
    const div = document.createElement('div');
    div.classList.add('mensaje', 'sistema');
    div.textContent = msg;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight; //autoscroll hacia el ultimo mensaje
});


// LA INSERCION DE LOS EMOJIS

const emojiBtn = document.getElementById('emoji-btn');
const emojiSelector = document.getElementById('emoji-selector');
const messageInput = document.getElementById('message-input');

// Mostrar/Ocultar el selector al hacer clic en el botón de emoji
emojiBtn.addEventListener('click', () => {
  emojiSelector.classList.toggle('hidden');
});

// Capturar el emoji seleccionado e insertarlo en el input
emojiSelector.addEventListener('emoji-click', (event) => {
  const emoji = event.detail.unicode; // Obtiene el carácter del emoji
  
  // Insertar el emoji en la posición del cursor
  const startPos = messageInput.selectionStart;
  const endPos = messageInput.selectionEnd;
  const text = messageInput.value;
  
  messageInput.value = text.substring(0, startPos) + emoji + text.substring(endPos);
  
  // Devolver el foco al input y posicionar el cursor después del emoji
  messageInput.focus();
  messageInput.selectionStart = messageInput.selectionEnd = startPos + emoji.length;
  
  // Opcional: Ocultar el selector después de elegir uno
  emojiSelector.classList.add('hidden');
});