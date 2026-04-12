// =============================================================================
// VAQUERO RUNNER — script.js
// =============================================================================

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const API_BASE   = "https://infiniterunner.onrender.com";
const SUELO_Y    = 360;       // Y donde comienza el suelo
const FUENTE     = "'Courier Prime', Courier, monospace";
const COLOR_TINTA = "#3E2723";
const COLOR_ARENA = "#FAD7A0";

// ─── CANVAS ──────────────────────────────────────────────────────────────────

const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");

// ─── ESTADO GLOBAL ───────────────────────────────────────────────────────────

let juegoIniciado     = false;
let juegoTerminado    = false;
let modoDificil       = false;
let modoSeleccionado  = false; // true = modo elegido, esperando 2º clic/Enter para iniciar
let teclaPulsada      = false;
let puedeReiniciar    = false;
let puntuacion        = 0;
let obstaculos        = [];
let listaTopScores    = [];
let incrementoExtremo = 25; // Configurable en el menú (1–50). Menor = acelera antes = más difícil.

// ─── RÉCORDS (se sincronizan con el servidor al iniciar) ─────────────────────

let recordNormal  = parseInt(localStorage.getItem("record_Normal"),  10) || 0;
let recordExtremo = parseInt(localStorage.getItem("record_Extremo"), 10) || 0;

// ─── NOMBRE DEL JUGADOR ──────────────────────────────────────────────────────

const nombreJugador = (() => {
  const guardado = localStorage.getItem("vaqueroNombre");
  if (guardado) return guardado;

  const input = prompt("Introduce tu nombre de vaquero:");
  const nombre =
    input && input.trim() !== ""
      ? input.trim()
      : "Forastero#" + Math.floor(Math.random() * 9000 + 1000);

  localStorage.setItem("vaqueroNombre", nombre);
  return nombre;
})();

// ─── PERSONAJE ───────────────────────────────────────────────────────────────

const personaje = {
  x: 50,
  y: 300,
  ancho: 50,
  alto: 40,
  dy: 0,
  salto: 18,
  gravedad: 0.7,
  enSuelo: false,
};

// =============================================================================
// API
// =============================================================================

async function enviarPuntuacion() {
  const dificultad = modoDificil ? "Extremo" : "Normal";

  try {
    const res = await fetch(`${API_BASE}/guardar-score`, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreJugador, puntos: puntuacion, dificultad }),
    });
    await res.json();
  } catch (err) {
    console.error("Error al guardar puntuación:", err);
  } finally {
    // Cargamos el ranking después de guardar (o si falla el guardado)
    await obtenerTopScores();
    puedeReiniciar = true;
  }
}

async function obtenerTopScores() {
  const dificultad = modoDificil ? "Extremo" : "Normal";

  try {
    const res  = await fetch(`${API_BASE}/top-scores?dificultad=${dificultad}`);
    listaTopScores = await res.json();
  } catch (err) {
    console.error("Error al obtener ranking:", err);
    listaTopScores = [];
  }
}

async function obtenerMiRecord() {
  const dificultad = modoDificil ? "Extremo" : "Normal";

  try {
    const res  = await fetch(`${API_BASE}/mi-record?nombre=${nombreJugador}&dificultad=${dificultad}`);
    const data = await res.json();
    if (modoDificil) recordExtremo = data.record;
    else             recordNormal  = data.record;
  } catch (err) {
    console.error("Error al sincronizar récord:", err);
  }
}

// =============================================================================
// LÓGICA DE JUEGO
// =============================================================================

function aplicarFisicas() {
  // Salto corto: si soltamos la tecla mientras subimos, frenamos antes
  personaje.dy += (personaje.dy < 0 && !teclaPulsada)
    ? personaje.gravedad * 2
    : personaje.gravedad;

  personaje.y += personaje.dy;

  // Aterrizaje
  const suelo = SUELO_Y - personaje.alto;
  if (personaje.y >= suelo) {
    personaje.y    = suelo;
    personaje.dy   = 0;
    personaje.enSuelo = true;
  }
}

function crearObstaculo() {
  const incremento      = modoDificil ? incrementoExtremo : 500;
  const velocidadActual = 5 + Math.floor(puntuacion / incremento);

  if (!modoDificil) {
    // NORMAL: hasta 4 balas separadas 300px entre sí
    const ultimo = obstaculos.at(-1);
    const hayHueco = !ultimo || canvas.width - ultimo.x > 300;

    if (obstaculos.length < 4 && hayHueco && Math.random() < 0.2) {
      obstaculos.push(crearBala(velocidadActual));
    }
  } else {
    // EXTREMO: 1 contra 1, solo cuando el vaquero pisa el suelo
    if (obstaculos.length === 0 && personaje.enSuelo && Math.random() < 0.05) {
      obstaculos.push(crearBala(velocidadActual));
    }
  }
}

function crearBala(velocidad) {
  return {
    x: canvas.width,
    y: 335,
    ancho: 30,
    alto: 10,
    velocidad,
  };
}

function manejarObstaculos() {
  const MARGEN = 20;

  for (let i = obstaculos.length - 1; i >= 0; i--) {
    const obs      = obstaculos[i];
    const xAnterior = obs.x;
    obs.x -= obs.velocidad;

    // Colisión con margen de justicia (comprueba posición anterior y actual)
    const colision =
      personaje.x + MARGEN < xAnterior + obs.ancho &&
      personaje.x + personaje.ancho - MARGEN > obs.x &&
      personaje.y + MARGEN < obs.y + obs.alto &&
      personaje.y + personaje.alto - MARGEN > obs.y;

    if (colision && !juegoTerminado) {
      juegoTerminado = true;
      if (navigator.vibrate) navigator.vibrate(100);
      enviarPuntuacion();
    }

    // Eliminar balas que han salido de pantalla
    if (obs.x < -obs.ancho) {
      obstaculos.splice(i, 1);
    }
  }
}

function actualizarRecord() {
  const recordActual = modoDificil ? recordExtremo : recordNormal;
  if (puntuacion > recordActual) {
    if (modoDificil) recordExtremo = puntuacion;
    else             recordNormal  = puntuacion;
  }
}

// =============================================================================
// DIBUJO
// =============================================================================

function pintarFondo() {
  const w = canvas.width;
  const h = canvas.height;

  // ── 1. CIELO con degradado horizonte ─────────────────────────────────────
  const gradCielo = ctx.createLinearGradient(0, 0, 0, SUELO_Y);
  gradCielo.addColorStop(0,   "#E8C98A"); // Naranja tostado arriba
  gradCielo.addColorStop(0.6, "#FAD7A0"); // Arena cálida al centro
  gradCielo.addColorStop(1,   "#F5C97A"); // Ocre al horizonte
  ctx.fillStyle = gradCielo;
  ctx.fillRect(0, 0, w, SUELO_Y);

  // ── 2. SOL ────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(680, 55, 32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 200, 80, 0.35)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(680, 55, 22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 210, 100, 0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(680, 55, 14, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 220, 120, 0.8)";
  ctx.fill();

  // ── 3. MONTAÑAS LEJANAS (capa más lenta, parallax ~5%) ───────────────────
  const offsetMont = (puntuacion * 0.4) % w;
  ctx.fillStyle = "rgba(180, 130, 90, 0.25)";
  for (let rep = 0; rep < 2; rep++) {
    const ox = -offsetMont + rep * w;
    // Serie de colinas suaves
    ctx.beginPath();
    ctx.moveTo(ox,        SUELO_Y);
    ctx.lineTo(ox,        230);
    ctx.lineTo(ox + 80,   180);
    ctx.lineTo(ox + 160,  230);
    ctx.lineTo(ox + 220,  200);
    ctx.lineTo(ox + 310,  160);
    ctx.lineTo(ox + 400,  210);
    ctx.lineTo(ox + 480,  175);
    ctx.lineTo(ox + 560,  220);
    ctx.lineTo(ox + 640,  190);
    ctx.lineTo(ox + 720,  240);
    ctx.lineTo(ox + 800,  SUELO_Y);
    ctx.closePath();
    ctx.fill();
  }

  // ── 4. CACTUS LEJANOS — capa lenta (parallax ~15%) ───────────────────────
  const offsetL = (puntuacion * 1.2) % w;
  dibujarCapaCactus(offsetL, 0.18, SUELO_Y, 0.6);

  // ── 5. CACTUS MEDIOS — capa media (parallax ~35%) ────────────────────────
  const offsetM = (puntuacion * 2.8) % w;
  dibujarCapaCactus(offsetM, 0.38, SUELO_Y, 0.9);

  // ── 6. SUELO ─────────────────────────────────────────────────────────────
  // Franja de tierra con degradado
  const gradSuelo = ctx.createLinearGradient(0, SUELO_Y, 0, h);
  gradSuelo.addColorStop(0,   "#5D3A1A");
  gradSuelo.addColorStop(0.3, "#3E2723");
  gradSuelo.addColorStop(1,   "#2A1A10");
  ctx.fillStyle = gradSuelo;
  ctx.fillRect(0, SUELO_Y, w, h - SUELO_Y);

  // Línea de horizonte del suelo
  ctx.fillStyle = "rgba(100, 60, 20, 0.6)";
  ctx.fillRect(0, SUELO_Y, w, 3);

  // Líneas de velocidad animadas en el suelo
  const velocidadEfecto = modoDificil ? 14 : 9;
  const offsetSuelo = (puntuacion * velocidadEfecto) % 120;
  ctx.fillStyle = "rgba(250, 215, 160, 0.15)";
  for (let i = 0; i < w + 120; i += 120) {
    ctx.fillRect(w - i + offsetSuelo, 372, 55, 2);
  }
  // Segunda capa de líneas más tenues y desfasadas
  ctx.fillStyle = "rgba(250, 215, 160, 0.07)";
  const offsetSuelo2 = (puntuacion * velocidadEfecto * 0.6) % 80;
  for (let i = 0; i < w + 80; i += 80) {
    ctx.fillRect(w - i + offsetSuelo2, 385, 30, 1);
  }
}

// Dibuja una capa de cactus que se desplaza en bucle con parallax
// offsetX: desplazamiento actual | escala: tamaño relativo | baseY: pie del cactus | alpha: opacidad
function dibujarCapaCactus(offsetX, escala, baseY, alpha) {
  // Posiciones fijas dentro del bucle (se repiten cada 800px)
  const posiciones = [80, 260, 430, 650, 750];

  ctx.fillStyle = `rgba(62, 39, 35, ${alpha * 0.35})`;

  posiciones.forEach((px) => {
    for (let rep = 0; rep < 2; rep++) {
      const x = ((px - offsetX + rep * canvas.width) % canvas.width + canvas.width) % canvas.width;
      dibujarCactus(x, baseY, escala);
    }
  });
}

// Dibuja un cactus pixel-art centrado en (cx, baseY) con la escala dada
function dibujarCactus(cx, baseY, escala) {
  const u = Math.max(2, Math.round(8 * escala)); // unidad de pixel

  // Tronco
  ctx.fillRect(cx - u,     baseY - u * 8, u * 2, u * 8);
  // Brazo izquierdo
  ctx.fillRect(cx - u * 4, baseY - u * 6, u * 3, u);       // horizontal
  ctx.fillRect(cx - u * 4, baseY - u * 8, u,     u * 2);   // vertical
  // Brazo derecho
  ctx.fillRect(cx + u,     baseY - u * 5, u * 3, u);       // horizontal
  ctx.fillRect(cx + u * 3, baseY - u * 7, u,     u * 2);   // vertical
}


function dibujarVaquero() {
  const { x, y, ancho, alto } = personaje;

  // Poncho
  ctx.fillStyle = "#A17F5B";
  ctx.fillRect(x, y, ancho, alto);

  // Franjas del poncho
  ctx.fillStyle = "rgba(62, 39, 35, 0.3)";
  ctx.fillRect(x, y + 15, ancho, 4);
  ctx.fillRect(x, y + 25, ancho, 3);

  // Chaleco de cuero
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(x + 8, y + 5, ancho - 16, alto - 10);

  // Cinturón
  ctx.fillStyle = COLOR_TINTA;
  ctx.fillRect(x + 5, y + alto - 8, ancho - 10, 6);

  // Ala del sombrero
  ctx.fillStyle = "#1A1410";
  ctx.fillRect(x - 5, y, ancho + 10, 7);

  // Copa del sombrero
  ctx.fillStyle = COLOR_TINTA;
  ctx.fillRect(x + 10, y - 12, ancho - 20, 12);
  ctx.fillStyle = "#1A1410";
  ctx.fillRect(x + 12, y - 10, ancho - 24, 10);

  // Piernas animadas
  ctx.fillStyle = COLOR_TINTA;
  const mov = Math.sin(puntuacion * 0.2) * 8;
  ctx.fillRect(x + 5,          y + alto, 10, 10 + mov);
  ctx.fillRect(x + ancho - 15, y + alto, 10, 10 - mov);
}

function dibujarBalas() {
  obstaculos.forEach((obs) => {
    // Cuerpo dorado
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(obs.x + 10, obs.y, obs.ancho - 10, obs.alto);

    // Brillo metálico superior
    ctx.fillStyle = "#FFF176";
    ctx.fillRect(obs.x + 10, obs.y, obs.ancho - 10, obs.alto / 3);

    // Sombra inferior
    ctx.fillStyle = "#B8860B";
    ctx.fillRect(obs.x + 10, obs.y + (obs.alto * 2 / 3), obs.ancho - 10, obs.alto / 3);

    // Culote
    ctx.fillStyle = COLOR_TINTA;
    ctx.fillRect(obs.x + obs.ancho - 3, obs.y, 3, obs.alto);

    // Punta de plomo
    ctx.fillStyle = "#546E7A";
    ctx.beginPath();
    ctx.moveTo(obs.x + 10, obs.y);
    ctx.lineTo(obs.x,      obs.y + obs.alto / 2);
    ctx.lineTo(obs.x + 10, obs.y + obs.alto);
    ctx.fill();
  });
}

function dibujarPuntuacionActual() {
  ctx.fillStyle = COLOR_TINTA;
  ctx.font      = `bold 20px ${FUENTE}`;

  ctx.textAlign = "left";
  ctx.fillText(`PUNTOS: ${puntuacion}`, 20, 40);

  const recordAMostrar = modoDificil ? recordExtremo : recordNormal;
  ctx.textAlign = "right";
  ctx.fillText(`MÁXIMA: ${recordAMostrar}`, canvas.width - 20, 40);
}

function dibujarMenuPrincipal() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = COLOR_ARENA;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = COLOR_TINTA;
  ctx.font      = `bold 36px ${FUENTE}`;
  ctx.fillText("ELIGE TU DESTINO", canvas.width / 2, 45);

  // Nombre del jugador
  ctx.font      = `16px ${FUENTE}`;
  ctx.fillStyle = "rgba(62, 39, 35, 0.6)";
  ctx.fillText(`✦ ${nombreJugador.toUpperCase()} ✦`, canvas.width / 2, 70);

  // Botón MODO NORMAL  (y: 90 → 145)
  ctx.lineWidth   = 4;
  ctx.strokeStyle = COLOR_TINTA;
  ctx.fillStyle   = !modoDificil ? COLOR_TINTA : "rgba(62, 39, 35, 0.1)";
  ctx.strokeRect(200, 90, 400, 55);
  ctx.fillRect(200, 90, 400, 55);

  ctx.fillStyle = !modoDificil ? COLOR_ARENA : COLOR_TINTA;
  ctx.font      = `bold 22px ${FUENTE}`;
  ctx.fillText("MODO NORMAL", canvas.width / 2, 126);

  // Botón MODO EXTREMO  (y: 160 → 215)
  ctx.fillStyle = modoDificil ? COLOR_TINTA : "rgba(62, 39, 35, 0.1)";
  ctx.strokeRect(200, 160, 400, 55);
  ctx.fillRect(200, 160, 400, 55);

  ctx.fillStyle = modoDificil ? COLOR_ARENA : COLOR_TINTA;
  ctx.font      = `bold 22px ${FUENTE}`;
  ctx.fillText("MODO EXTREMO", canvas.width / 2, 196);

  ctx.fillStyle = COLOR_TINTA;
  ctx.font      = `16px ${FUENTE}`;
  if (modoSeleccionado) {
    ctx.fillText("── PULSA ENTER, ESPACIO O CLIC PARA JUGAR ──", canvas.width / 2, 235);
  } else {
    ctx.fillText("Haz clic en un modo para seleccionarlo", canvas.width / 2, 235);
  }

  // Slider de aceleración (solo visible con EXTREMO seleccionado)
  if (modoDificil) {
    dibujarSliderExtremo();
  }
}

// Geometría del slider — única fuente de verdad para dibujo y hit-testing
const SLIDER = {
  x: 200, y: 280, ancho: 400, alto: 12, btnR: 10,
  min: 1,  max: 50,
  thumbX() {
    return this.x + ((incrementoExtremo - this.min) / (this.max - this.min)) * this.ancho;
  },
};

function dibujarSliderExtremo() {
  const { x, y, ancho, alto, btnR, min, max } = SLIDER;
  const tx = SLIDER.thumbX();

  // Etiqueta
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR_TINTA;
  ctx.font      = `bold 13px ${FUENTE}`;
  ctx.fillText("VELOCIDAD DE ACELERACIÓN — MODO EXTREMO", canvas.width / 2, y - 18);

  // Leyendas extremos
  ctx.font      = `11px ${FUENTE}`;
  ctx.textAlign = "left";
  ctx.fillText("MÁS RÁPIDO", x, y - 5);
  ctx.textAlign = "right";
  ctx.fillText("MÁS LENTO", x + ancho, y - 5);

  // Track izquierda (rellena)
  ctx.fillStyle = COLOR_TINTA;
  ctx.fillRect(x, y, tx - x, alto);

  // Track derecha (vacía)
  ctx.fillStyle = "rgba(62,39,35,0.2)";
  ctx.fillRect(tx, y, x + ancho - tx, alto);

  // Thumb
  ctx.beginPath();
  ctx.arc(tx, y + alto / 2, btnR, 0, Math.PI * 2);
  ctx.fillStyle   = COLOR_TINTA;
  ctx.fill();
  ctx.strokeStyle = COLOR_ARENA;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Valor numérico bajo el thumb
  ctx.fillStyle = COLOR_TINTA;
  ctx.font      = `bold 14px ${FUENTE}`;
  ctx.textAlign = "center";
  ctx.fillText(incrementoExtremo, tx, y + alto + 20);
}

function dibujarRanking() {
  const margin     = canvas.width * 0.05;
  const tablaAncho = canvas.width * 0.9;
  const tablaX     = margin;

  // Fondo del pergamino
  ctx.fillStyle = "rgba(250, 215, 160, 0.98)";
  ctx.fillRect(tablaX, 10, tablaAncho, 380);
  ctx.strokeStyle = COLOR_TINTA;
  ctx.lineWidth   = 4;
  ctx.strokeRect(tablaX, 10, tablaAncho, 380);

  ctx.fillStyle = COLOR_TINTA;
  ctx.textAlign = "center";

  // Puntuación final
  ctx.font = `bold 16px ${FUENTE}`;
  ctx.fillText("PUNTUACIÓN FINAL", canvas.width / 2, 35);
  ctx.font = `bold 32px ${FUENTE}`;
  ctx.fillText(puntuacion, canvas.width / 2, 70);

  // ¿Nuevo récord?
  const recordActual = modoDificil ? recordExtremo : recordNormal;
  const tieneRecord  = puntuacion >= recordActual && puntuacion > 0;
  if (tieneRecord) {
    ctx.font      = `bold 14px ${FUENTE}`;
    ctx.fillStyle = "#8B4513";
    ctx.fillText("⭐ ¡NUEVO RÉCORD! ⭐", canvas.width / 2, 92);
    ctx.fillStyle = COLOR_TINTA;
  }

  // Cabecera de la tabla
  const colIzquierda = tablaX + 40;
  const colDerecha   = tablaX + tablaAncho - 40;
  const yTablaStart  = tieneRecord ? 125 : 110;

  ctx.font      = `bold 15px ${FUENTE}`;
  ctx.textAlign = "left";
  ctx.fillText("FORASTERO", colIzquierda, yTablaStart);
  ctx.textAlign = "right";
  ctx.fillText("PUNTOS", colDerecha, yTablaStart);

  ctx.beginPath();
  ctx.moveTo(colIzquierda, yTablaStart + 6);
  ctx.lineTo(colDerecha,   yTablaStart + 6);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Listado top 5
  ctx.font = `bold 15px ${FUENTE}`;
  listaTopScores.slice(0, 5).forEach((score, index) => {
    const yPos       = yTablaStart + 35 + index * 28;
    const nombreCorto = score.nombre.length > 15
      ? score.nombre.substring(0, 12) + ".."
      : score.nombre;

    ctx.shadowColor   = "rgba(255, 255, 255, 0.5)";
    ctx.shadowBlur    = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.textAlign = "left";
    ctx.fillText(`${index + 1}. ${nombreCorto.toUpperCase()}`, colIzquierda, yPos);

    ctx.textAlign = "right";
    ctx.fillText(`${score.puntos}`, colDerecha, yPos);

    ctx.shadowBlur    = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });

  // Botón de reinicio
  ctx.textAlign = "center";
  ctx.font      = `bold 18px ${FUENTE}`;
  ctx.fillText(puedeReiniciar ? "CLIC PARA REINTENTAR" : "⌛ REGISTRANDO...", canvas.width / 2, 375);
}

// =============================================================================
// BUCLE PRINCIPAL
// =============================================================================

function actualizar() {
  if (!juegoIniciado) {
    dibujarMenuPrincipal();
    return;
  }

  if (juegoTerminado) {
    dibujarRanking();
    requestAnimationFrame(actualizar);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  pintarFondo();
  aplicarFisicas();
  crearObstaculo();
  manejarObstaculos();
  dibujarVaquero();
  dibujarBalas();
  actualizarRecord();
  dibujarPuntuacionActual();

  puntuacion++;
  requestAnimationFrame(actualizar);
}

// =============================================================================
// INICIO DE PARTIDA
// =============================================================================

function iniciarPartida() {
  obtenerTopScores();
  obtenerMiRecord();
  juegoIniciado = true;
  actualizar();
}

function saltar() {
  if (personaje.enSuelo) {
    personaje.dy      = -personaje.salto;
    personaje.enSuelo = false;
    teclaPulsada      = true;
  }
}

// =============================================================================
// EVENTOS DE ENTRADA (consolidados en un único listener por tipo)
// =============================================================================

window.addEventListener("keydown", (e) => {
  // Teclas de menú
  if (!juegoIniciado) {
    // 1 y 2: seleccionan el modo directamente (mantiene acceso rápido)
    if (e.key === "1") { modoDificil = false; modoSeleccionado = true; dibujarMenuPrincipal(); return; }
    if (e.key === "2") { modoDificil = true;  modoSeleccionado = true; dibujarMenuPrincipal(); return; }

    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (modoSeleccionado) {
        // 2º paso: ya hay modo elegido → iniciar
        iniciarPartida();
      } else {
        // Aún no hay modo elegido → seleccionar NORMAL por defecto
        modoDificil = false;
        modoSeleccionado = true;
        dibujarMenuPrincipal();
      }
    }
    return;
  }

  // Game over
  if (juegoTerminado) {
    if ((e.code === "Space" || e.code === "KeyR") && puedeReiniciar) {
      document.location.reload();
    }
    return;
  }

  // Jugando
  if (e.code === "Space") {
    e.preventDefault();
    saltar();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") teclaPulsada = false;
});

// Toque / clic en el canvas
let arrastandoSlider = false;

canvas.addEventListener("pointerdown", (e) => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top)  * scaleY;

  if (!juegoIniciado) {
    // ── Interacción con el slider (solo si EXTREMO está seleccionado) ──
    if (modoDificil && modoSeleccionado) {
      const { x, y, ancho, alto, btnR } = SLIDER;
      const enTrack = clickX >= x - btnR && clickX <= x + ancho + btnR &&
                      clickY >= y - btnR && clickY <= y + alto + btnR + 20;
      if (enTrack) {
        arrastandoSlider = true;
        canvas.setPointerCapture(e.pointerId);
        // Saltar el thumb directamente a donde se hizo clic
        const ratio = Math.max(0, Math.min(1, (clickX - x) / ancho));
        incrementoExtremo = Math.round(SLIDER.min + ratio * (SLIDER.max - SLIDER.min));
        dibujarMenuPrincipal();
        return;
      }
    }

    const enBotonNormal  = clickX >= 200 && clickX <= 600 && clickY >= 90  && clickY <= 145;
    const enBotonExtremo = clickX >= 200 && clickX <= 600 && clickY >= 160 && clickY <= 215;

    if (enBotonNormal) {
      if (modoSeleccionado && !modoDificil) {
        // 2º clic en el botón ya seleccionado → iniciar
        iniciarPartida();
      } else {
        modoDificil = false;
        modoSeleccionado = true;
        dibujarMenuPrincipal();
      }
    } else if (enBotonExtremo) {
      if (modoSeleccionado && modoDificil) {
        // 2º clic en el botón ya seleccionado → iniciar
        iniciarPartida();
      } else {
        modoDificil = true;
        modoSeleccionado = true;
        dibujarMenuPrincipal();
      }
    }
    return;
  }

  if (juegoTerminado) {
    if (puedeReiniciar) document.location.reload();
    return;
  }

  saltar();
});

canvas.addEventListener("pointermove", (e) => {
  if (!arrastandoSlider) return;

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const clickX = (e.clientX - rect.left) * scaleX;

  const ratio = Math.max(0, Math.min(1, (clickX - SLIDER.x) / SLIDER.ancho));
  incrementoExtremo = Math.round(SLIDER.min + ratio * (SLIDER.max - SLIDER.min));

  // Redibujar menú para que el slider se actualice en tiempo real
  dibujarMenuPrincipal();
});

canvas.addEventListener("pointerup", () => {
  arrastandoSlider = false;
});

// Soltar toque (salto corto en móvil)
window.addEventListener("pointerup", () => {
  teclaPulsada = false;
});

// =============================================================================
// ARRANQUE
// =============================================================================

actualizar();