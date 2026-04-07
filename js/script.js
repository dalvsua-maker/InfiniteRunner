const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let juegoIniciado = false;
let modoDificil = false; // False = Normal (500), True = Extremo (50)
let teclaPulsada = false;

// 1. Nueva variable de estado al principio del archivo
let juegoTerminado = false;
let puntuacion = 0;
// Configuración del personaje
let personaje = {
  x: 50,
  y: 300,
  ancho: 50,
  alto: 40,
  color: "#ff4757",
  dy: 0, // Velocidad vertical
  salto: 15, // Aumentamos de 12 a 15 para que salte más explosivo
  gravedad: 1.0, // Aumentamos de 0.6 a 1.0 para que caiga rápido
  enSuelo: false,
};
// Añade esto al principio para pedir el nombre al iniciar
let nombreJugador = prompt("Introduce tu nombre de vaquero:") || "Forastero";

function enviarPuntuacion() {
    const datos = {
        nombre: nombreJugador,
        puntos: puntuacion,
        dificultad: modoDificil ? "Extremo" : "Normal"
    };

    // Cambiamos el localhost por tu servidor real en la nube
    fetch('https://onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    })
    .then(res => res.json())
    .then(data => console.log(data.mensaje))
    .catch(err => console.error("Error al guardar:", err));
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
  ctx.fillText("Puntuación: " + puntuacion, 20, 30);
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
  // Ajustamos ligeramente para que la punta de la bala tenga que entrar
  // un poco en el cuerpo del vaquero para morir (más justo)
  return (
    player.x + 10 < obj.x + obj.ancho &&
    player.x + player.ancho - 10 > obj.x &&
    player.y + 5 < obj.y + obj.alto &&
    player.y + player.alto > obj.y
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
   
    ctx.fillStyle = "rgba(0,0,0,0.5)"; // Fondo semitransparente
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.fillText("¡GAME OVER!", canvas.width / 2 - 120, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText(
      "Pulsa 'R' para reiniciar",
      canvas.width / 2 - 100,
      canvas.height / 2 + 40,
    );
    return; // Detiene el bucle aquí
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

actualizar();
