const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let juegoIniciado = false;
let modoDificil = false; // False = Normal (500), True = Extremo (50)
let teclaPulsada = false;

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
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    teclaPulsada = true;
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
  // PANTALLA DE MENÚ
  if (!juegoIniciado) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.fillText(
      "ELIGE TU MODO",
      canvas.width / 2 - 110,
      canvas.height / 2 - 40,
    );
    ctx.font = "20px Arial";
    ctx.fillText(
      "Pulsa '1' para Modo Normal",
      canvas.width / 2 - 120,
      canvas.height / 2,
    );
    ctx.fillText(
      "Pulsa '2' para Modo Extremo",
      canvas.width / 2 - 125,
      canvas.height / 2 + 30,
    );
    return; // No sigue ejecutando el juego hasta que elijas
  }
if (juegoTerminado) {
  // Dentro del bloque if (juegoTerminado)
const tituloModo = modoDificil ? "TOP 5 EXTREMO" : "TOP 5 NORMAL";
ctx.fillText(`🏆 ${tituloModo} 🏆`, canvas.width / 2 - 110, 160);
    // 1. Fondo más oscuro para que resalten las letras
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Título principal (Subido un poco más)
    ctx.fillStyle = "#E74C3C"; // Rojo vibrante
    ctx.font = "bold 45px Arial";
    ctx.fillText("¡GAME OVER!", canvas.width / 2 - 140, 100);

    // 3. Ranking Mundial (Dorado y con espacio)
    ctx.fillStyle = "#F1C40F";
    ctx.font = "22px Arial";
    ctx.fillText("🏆 TOP 5 VAQUEROS 🏆", canvas.width / 2 - 110, 160);

    // 4. Lista de puntuaciones (Bajada para que no toque el título)
    ctx.fillStyle = "white";
    ctx.font = "18px Courier New"; // Fuente tipo consola queda muy bien
    listaTopScores.forEach((score, index) => {
        let yPos = 200 + (index * 30);
        // Alineación simple: Número. Nombre : Puntos
        ctx.fillText(`${index + 1}. ${score.nombre.padEnd(12)} : ${score.puntos}`, canvas.width / 2 - 100, yPos);
    });

    // 5. Instrucciones de reinicio (Abajo del todo)
    ctx.fillStyle = "#BDC3C7"; // Gris claro
    ctx.font = "16px Arial";
    ctx.fillText("Pulsa 'R' o Toca para volver a intentar", canvas.width / 2 - 135, 370);
    
    return; 
}
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar pantalla

  // 1. Cielo del desierto (Cambiamos el borrado por un color)
  ctx.fillStyle = "#FAD7A0"; // Un naranja/arena suave
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Dibujar el Sol (decorativo)
  ctx.fillStyle = "#F1C40F";
  ctx.beginPath();
  ctx.arc(700, 60, 30, 0, Math.PI * 2);
  ctx.fill();

  // 3. Suelo de arena oscura
  ctx.fillStyle = "#D35400";
  ctx.fillRect(0, 360, canvas.width, 40);

  aplicarFisicas();
  dibujarPersonaje();
  crearObstaculo();
  manejarObstaculos();
  if (juegoTerminado) {
        let recordActual = modoDificil ? recordExtremo : recordNormal;
        
        if (puntuacion > recordActual) {
            if (modoDificil) recordExtremo = puntuacion;
            else recordNormal = puntuacion;
            console.log("¡Nuevo récord personal alcanzado!");
        }
        
       
    }
  dibujarPuntuacion();
  puntuacion++;
  frameCount++; // Aumentamos el contador de tiempo del juego
  requestAnimationFrame(actualizar); // Crea el bucle infinito
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
    // 1. Obtener las coordenadas reales donde se pulsó
    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top; // Posición Y dentro del canvas visual
    const alturaTotal = rect.height;    // Altura que el canvas ocupa en pantalla

    // --- LÓGICA DE MENÚ (Elegir dificultad) ---
    if (!juegoIniciado) {
        // Si pulsas en la mitad superior (menos del 50% de la altura)
        if (clickY < alturaTotal / 2) {
            modoDificil = false; // MODO NORMAL
            console.log("Seleccionado: Normal");
        } else {
            modoDificil = true;  // MODO EXTREMO
            console.log("Seleccionado: Extremo");
        }
        obtenerTopScores();
        obtenerMiRecord();
        juegoIniciado = true;
        actualizar(); // Arrancar el juego
        return;
    }

    // --- LÓGICA DE REINICIO ---
    if (juegoTerminado) {
        document.location.reload();
        return;
    }

    // --- LÓGICA DE SALTO ---
    if (personaje.enSuelo) {
        personaje.dy = -personaje.salto;
        personaje.enSuelo = false;
        teclaPulsada = true; // Para que el salto sea largo si mantienes
    }
});
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
