const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let juegoIniciado = false;
let modoDificil = false; // False = Normal (500), True = Extremo (50)
let teclaPulsada = false;
let puedeReiniciar = false;
// 1. Nueva variable de estado al principio del archivo
let juegoTerminado = false;
let puntuacion = 0;
let listaTopScores = []; // Para el ranking global
let recordNormal = localStorage.getItem("record_Normal") || 0; // Record personal Normal
let recordExtremo = localStorage.getItem("record_Extremo") || 0; // Record personal Extremo
// Configuración del personaje
let personaje = {
  x: 50,
  y: 300,
  ancho: 50,
  alto: 40,
  color: "#ff4757",
  dy: 0,
  salto: 18,      // Más explosivo hacia arriba
  gravedad: 0.7,  // Cae más lento, se siente más ágil
  enSuelo: false,
};
// Añade esto al principio para pedir el nombre al iniciar
// Intentamos recuperar el nombre del "almacén" del navegador
let nombreGuardado = localStorage.getItem("vaqueroNombre");
let nombreJugador;

if (nombreGuardado) {
    nombreJugador = nombreGuardado;
} else {
    let input = prompt("Introduce tu nombre de vaquero:");
    // Si no hay input, genera el Forastero único
    nombreJugador = (input && input.trim() !== "") ? input : "Forastero#" + Math.floor(Math.random() * 9000 + 1000);
    localStorage.setItem("vaqueroNombre", nombreJugador);
}

function enviarPuntuacion() {
    const datos = {
        nombre: nombreJugador,
        puntos: puntuacion,
        dificultad: modoDificil ? "Extremo" : "Normal"
    };

    fetch('https://infiniterunner.onrender.com/guardar-score', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    })
    .then(res => res.json())
    .then(data => {
        console.log("Servidor dice:", data.mensaje);
        // JUSTO AQUÍ PEDIMOS EL TOP
        obtenerTopScores(); 
    })
    .catch(err => console.error("Error al guardar:", err));
    // Seguridad extra: si el servidor tarda mucho, 
    // permitimos reiniciar tras 1.5 segundos de todos modos
    setTimeout(() => { puedeReiniciar = true; }, 1500);
}

// Creamos esta función aparte para poder usarla cuando queramos
function obtenerTopScores() {
    const modoActual = modoDificil ? "Extremo" : "Normal";
    const url = `https://infiniterunner.onrender.com/top-scores?dificultad=${modoActual}`;
    
    console.log("Solicitando ranking a:", url);

    fetch(url)
        .then(res => {
            console.log("Status del servidor:", res.status);
            return res.json();
        })
        .then(data => {
            console.log("Datos recibidos:", data);
            listaTopScores = data;
        })
        .catch(err => {
            console.error("Error en la conexión con Render:", err);
            listaTopScores = []; // Limpiamos en caso de error
        });
}
function dibujarPersonaje() {
  // Cuerpo/Poncho
  ctx.fillStyle = "#795548"; // Marrón
  ctx.fillRect(
    personaje.x,
    personaje.y + 20,
    personaje.ancho,
    personaje.alto - 20,
  );

  // Cabeza
  ctx.fillStyle = "#ffdbac"; // Piel
  ctx.fillRect(personaje.x + 10, personaje.y + 5, 30, 20);

  // Sombrero
  ctx.fillStyle = "black";
  ctx.fillRect(personaje.x, personaje.y, 50, 10); // Ala del sombrero
  ctx.fillRect(personaje.x + 10, personaje.y - 10, 30, 15); // Copa
}

function aplicarFisicas() {
  // Si está subiendo y soltamos la tecla, cae más rápido (salto corto)
  if (personaje.dy < 0 && !teclaPulsada) {
    personaje.dy += personaje.gravedad * 2; // Doble gravedad para frenar el salto
  } else {
    personaje.dy += personaje.gravedad;
  }
  
  personaje.y += personaje.dy;

  if (personaje.y + personaje.alto > 360) {
    personaje.y = 360 - personaje.alto;
    personaje.dy = 0;
    personaje.enSuelo = true;
  }
}


// Control del salto
window.addEventListener("keydown", (event) => {
  // BLOQUEO DE SCROLL: Si pulsas espacio, la página se queda quieta
  if (event.code === "Space") {
    event.preventDefault();
  }

  // LÓGICA DE TECLA PULSADA
  if (event.code === "Space") {
    teclaPulsada = true;

    // A. Si estamos en el menú: Cambiar modo
    if (!juegoIniciado) {
      modoDificil = !modoDificil;
      return; 
    }

    // B. Si el juego ha terminado: Reiniciar
    if (juegoTerminado && puedeReiniciar) {
      document.location.reload();
      return;
    }

    // C. Si estamos jugando: Saltar
    if (personaje.enSuelo) {
      personaje.dy = -personaje.salto;
      personaje.enSuelo = false;
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    teclaPulsada = false;
  }
});

let obstaculos = [];
let frameCount = 0; // Contador para saber cuándo crear un obstáculo nuevo

function crearObstaculo() {
  let incremento = modoDificil ? 50 : 500;
  let velocidadActual = 5 + Math.floor(puntuacion / incremento);

    // MODO NORMAL: El equilibrio perfecto
  if (!modoDificil) {
    let ultimo = obstaculos[obstaculos.length - 1];
    
    // 350px es la distancia mágica: permite 2-3 balas en pantalla
    // y siempre deja hueco para aterrizar y volver a saltar.
    let distanciaFija = 300; 

    if (obstaculos.length < 4 && (!ultimo || (canvas.width - ultimo.x) > distanciaFija)) {
      // Usamos una probabilidad alta para que salgan en cuanto se cumpla la distancia
      if (Math.random() < 0.2) { 
        obstaculos.push({
          x: canvas.width,
          y: 335,
          ancho: 30, alto: 10,
          color: "#2ed573", 
          velocidad: velocidadActual
        });
      }
    }
  }
  // REGLA MODO EXTREMO: 1 contra 1, solo cuando el jugador aterriza
  else {
    if (obstaculos.length === 0 && personaje.enSuelo) {
      if (Math.random() < 0.05) {
        // Probabilidad más alta para que no tarde tanto en salir
        obstaculos.push({
          x: canvas.width,
          y: 335,
          ancho: 30,
          alto: 10,
          color: "#ff9f43",
          velocidad: velocidadActual,
        });
      }
    }
  }
}

function dibujarPuntuacion() {
  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText("Puntos: " + puntuacion, 20, 30);

  // 1. Elegimos qué valor mostrar según el modo
  let recordAMostrar = modoDificil ? recordExtremo : recordNormal;
  
  // 2. Elegimos qué etiqueta de texto poner
  let nombreModo = modoDificil ? "Extremo" : "Normal";

  ctx.font = "16px Arial";
  ctx.fillStyle = "#555"; // Un gris para que no distraiga tanto como los puntos
  ctx.fillText("Tu Récord (" + nombreModo + "): " + recordAMostrar, 20, 55);
}
function manejarObstaculos() {
  for (let i = 0; i < obstaculos.length; i++) {
    let obs = obstaculos[i];
    obs.x -= obs.velocidad;

    // Cuerpo de la bala (usa las medidas exactas del objeto)
    ctx.fillStyle = "black"; // Borde/Sombra
    ctx.fillRect(obs.x - 1, obs.y - 1, obs.ancho + 2, obs.alto + 2);

    ctx.fillStyle = "gold"; // Cuerpo
    ctx.fillRect(obs.x, obs.y, obs.ancho, obs.alto);
 // Dentro de manejarObstaculos
if (detectarColision(personaje, obs) && !juegoTerminado) { // <--- Añadimos !juegoTerminado
    juegoTerminado = true;
    if (navigator.vibrate) {
    navigator.vibrate(100); // El móvil vibrará 100 milisegundos al morir
}
    enviarPuntuacion(); // Esta será ahora la ÚNICA llamada en todo el script
}

    // 3. Optimización: Si el obstáculo se sale por la izquierda, quitarlo de la lista
    if (obs.x < -obs.ancho) {
      obstaculos.splice(i, 1);
      i--;
    }
  }
}
function detectarColision(player, obj) {
  // Reducimos la caja de colisión del jugador 15px por cada lado
  // Así, si le roza un píxel, no muere. Se siente mucho más "justo".
  const margen = 15; 
  
  return (
    player.x + margen < obj.x + obj.ancho &&
    player.x + player.ancho - margen > obj.x &&
    player.y + margen < obj.y + obj.alto &&
    player.y + player.alto - margen > obj.y
  );
}

function actualizar() {
    // --- 1. ESTADO: MENÚ ---
    if (!juegoIniciado) {
        dibujarMenuPrincipal();
        return;
    }

    // --- 2. ESTADO: GAME OVER ---
    if (juegoTerminado) {
        dibujarRanking();
        requestAnimationFrame(actualizar); 
        return;
    }

    // --- 3. ESTADO: JUEGO EN MARCHA ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo Estilo Cartel
    ctx.fillStyle = "#FAD7A0"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Suelo de Tinta
    ctx.fillStyle = "#3E2723";
    ctx.fillRect(0, 360, canvas.width, 40);

    // --- LÓGICA DE FÍSICAS (Tu trabajo previo) ---
    aplicarFisicas();
    crearObstaculo();
    manejarObstaculos();

    // --- DIBUJO DE ELEMENTOS (Nuevas funciones estéticas) ---
    dibujarVaquero();      // Antes era dibujarPersonaje()
    dibujarBalas();        // Antes estaba dentro de manejarObstaculos o suelto

// 1. LÓGICA DE RÉCORDS (Actualizamos la variable antes de pintar)
    let recordActual = modoDificil ? recordExtremo : recordNormal;
    if (puntuacion > recordActual) {
        if (modoDificil) recordExtremo = puntuacion;
        else recordNormal = puntuacion;
    }

    dibujarPuntuacionActual(); // Función para pintar los puntos arriba
    
    puntuacion++;
    frameCount++; 
    requestAnimationFrame(actualizar);
}
// Escuchar la tecla 'R' para reiniciar
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && juegoTerminado) {
    document.location.reload();
  }
});
window.addEventListener("keydown", (e) => {
  if (!juegoIniciado) {
    if (e.key === "1") {
      modoDificil = false;
      juegoIniciado = true;
      actualizar(); // Arrancamos el bucle
    }
    if (e.key === "2") {
      modoDificil = true;
      juegoIniciado = true;
      actualizar(); // Arrancamos el bucle
    }
  }
});
canvas.addEventListener("pointerdown", (e) => {
const rect = canvas.getBoundingClientRect();
    
    // Factor de escala: relaciona el tamaño real (800x400) con el tamaño visual en pantalla
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Posición del clic ajustada a la escala del juego
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (!juegoIniciado) {
        // Detectar si el clic está dentro del botón NORMAL (x:200-600, y:120-180)
        if (clickX >= 200 && clickX <= 600 && clickY >= 120 && clickY <= 180) {
            modoDificil = false;
            iniciarPartida();
        } 
        // Detectar si el clic está dentro del botón EXTREMO (x:200-600, y:220-280)
        else if (clickX >= 200 && clickX <= 600 && clickY >= 220 && clickY <= 280) {
            modoDificil = true;
            iniciarPartida();
        }
        return;
    }

    // --- LÓGICA DE REINICIO ---
    if (juegoTerminado) {
   if (puedeReiniciar) {
            document.location.reload();
        } else {
            console.log("Espera un momento antes de reiniciar...");
        }
        return;
    }

    // --- LÓGICA DE SALTO ---
    if (personaje.enSuelo) {
        personaje.dy = -personaje.salto;
        personaje.enSuelo = false;
        teclaPulsada = true; // Para que el salto sea largo si mantienes
    }
});
function iniciarPartida() {
    console.log("Iniciando en modo:", modoDificil ? "Extremo" : "Normal");
    obtenerTopScores();
    obtenerMiRecord();
    juegoIniciado = true;
    actualizar();
}
// --- NUEVOS MÉTODOS DE ESTÉTICA ---

// === NUEVAS FUNCIONES DE DIBUJO AISLADAS ===

function dibujarMenuPrincipal() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FAD7A0"; // Fondo Arena
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#3E2723"; // Color Tinta
    ctx.font = "bold 42px 'Courier Prime', Courier, monospace";
    ctx.fillText("ELIGE TU DESTINO", canvas.width / 2, 100);

    // Botón MODO NORMAL
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3E2723";
    ctx.fillStyle = !modoDificil ? "#3E2723" : "rgba(62, 39, 35, 0.1)";
    ctx.strokeRect(200, 140, 400, 65);
    ctx.fillRect(200, 140, 400, 65);
    
    ctx.fillStyle = !modoDificil ? "#FAD7A0" : "#3E2723";
    ctx.font = "bold 24px 'Courier Prime'";
    ctx.fillText("MODO NORMAL", canvas.width / 2, 182);

    // Botón MODO EXTREMO
    ctx.fillStyle = modoDificil ? "#3E2723" : "rgba(62, 39, 35, 0.1)";
    ctx.strokeRect(200, 240, 400, 65);
    ctx.fillRect(200, 240, 400, 65);
    
    ctx.fillStyle = modoDificil ? "#FAD7A0" : "#3E2723";
    ctx.fillText("MODO EXTREMO", canvas.width / 2, 282);

    ctx.fillStyle = "#3E2723";
    ctx.font = "16px 'Courier Prime'";
    ctx.fillText("Haz clic para seleccionar y empezar el duelo", canvas.width / 2, 350);
}

function dibujarVaquero() {
    ctx.fillStyle = "#3E2723"; // Color Tinta
    // Cuerpo
    ctx.fillRect(personaje.x, personaje.y, personaje.ancho, personaje.alto);
    // Sombrero (Ala y Copa)
    ctx.fillRect(personaje.x - 5, personaje.y, personaje.ancho + 10, 7);
    ctx.fillRect(personaje.x + 10, personaje.y - 12, personaje.ancho - 20, 12);
}

function dibujarBalas() {
    ctx.fillStyle = "#3E2723";
    obstaculos.forEach(obs => {
        // Cuerpo de la bala
        ctx.fillRect(obs.x, obs.y, obs.ancho, obs.alto);
        // Punta redondeada
        ctx.beginPath();
        ctx.arc(obs.x, obs.y + obs.alto / 2, obs.alto / 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function dibujarPuntuacionActual() {
    ctx.fillStyle = "#3E2723"; // Color Tinta
    ctx.font = "bold 20px 'Courier Prime', monospace";
    ctx.textAlign = "left";
    
    // Dibujamos la puntuación de la partida
    ctx.fillText(`PUNTOS: ${puntuacion}`, 20, 40);

    // Dibujamos el récord personal (Máxima)
    let recordAMostrar = modoDificil ? recordExtremo : recordNormal;
    ctx.textAlign = "right";
    ctx.fillText(`MÁXIMA: ${recordAMostrar}`, canvas.width - 20, 40);
}
function dibujarRanking() {
    // 1. Fondo del pergamino
    ctx.fillStyle = "rgba(250, 215, 160, 0.98)"; 
    ctx.fillRect(120, 30, 560, 340);
    ctx.strokeStyle = "#3E2723"; 
    ctx.lineWidth = 4;
    ctx.strokeRect(120, 30, 560, 340);

    ctx.fillStyle = "#3E2723";
    ctx.textAlign = "center";
    ctx.font = "bold 30px 'Courier Prime', Courier, monospace";
    ctx.fillText("¡HAS MORDIDO EL POLVO!", canvas.width / 2, 75); // Subido un pelín

    // 2. Cabecera de la tabla
    ctx.font = "bold 18px 'Courier Prime'";
    ctx.textAlign = "left"; 
    ctx.fillText("FORASTERO", 170, 115); // Ajustado
    ctx.textAlign = "right"; 
    ctx.fillText("PUNTOS", 630, 115); // Ajustado
    
    // Línea divisoria
    ctx.beginPath();
    ctx.moveTo(170, 125);
    ctx.lineTo(630, 125);
    ctx.stroke();

    // 3. Listado de puntuaciones (Ajustamos yPos para que no se corte el 1)
    ctx.font = "16px 'Courier Prime'";
    listaTopScores.slice(0, 5).forEach((score, index) => {
        // He cambiado 170 por 165 y el multiplicador para dar espacio
        let yPos = 165 + (index * 38); 
        ctx.textAlign = "left";
        ctx.fillText(`${index + 1}. ${score.nombre.toUpperCase()}`, 170, yPos);
        ctx.textAlign = "right";
        ctx.fillText(`${score.puntos}`, 630, yPos);
    });

    // 4. Botón de reinicio
    ctx.textAlign = "center";
    let textoBoton = puedeReiniciar ? "CLIC PARA VOLVER A INTENTAR" : "⌛ REGISTRANDO...";
    ctx.font = "bold 20px 'Courier Prime'";
    ctx.fillText(textoBoton, canvas.width / 2, 355);
}
function obtenerMiRecord() {
    const dificultad = modoDificil ? "Extremo" : "Normal";
    const url = `https://infiniterunner.onrender.com/mi-record?nombre=${nombreJugador}&dificultad=${dificultad}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (modoDificil) {
                recordExtremo = data.record;
            } else {
                recordNormal = data.record;
            }
            console.log("Récord de la base de datos sincronizado:", data.record);
        })
        .catch(err => console.error("Error al sincronizar récord:", err));
}
// Para el salto corto (soltar el dedo/ratón)
window.addEventListener("pointerup", () => {
    teclaPulsada = false;
});
actualizar();
