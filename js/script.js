// =============================================================================
// VAQUERO RUNNER — script.js  (refactorizado a OOP)
// =============================================================================

// ─── CONSTANTES GLOBALES ─────────────────────────────────────────────────────
const FRASES_DERROTA = [
  "¡VUELVE A LA SILLA, VAQUERO!",
  "EL DESIERTO NO PERDONA...",
  "¡CASI DESENFUNDAS A TIEMPO!",
  "ESA BALA TENÍA TU NOMBRE...",
  "NI EL MÁS RÁPIDO VIVE SIEMPRE.",
  "¡RECARGA Y VUELVE A INTENTARLO!",
  "HAS MUERTO CON LAS BOTAS PUESTAS."
];

const API_BASE    = "https://infiniterunner.onrender.com";
const SUELO_Y     = 360;
const FUENTE      = "'Courier Prime', Courier, monospace";
const COLOR_TINTA = "#3E2723";
const COLOR_ARENA = "#FAD7A0";
const ALTURA_BAJA = SUELO_Y - 25;
const ALTURA_ALTA = SUELO_Y - 85;

const PATRONES_NORMAL = [
  [{ gap: 600, y: ALTURA_BAJA }, { gap: 200, y: ALTURA_BAJA }],
  [{ gap: 700, y: ALTURA_BAJA }, { gap: 250, y: ALTURA_ALTA }],
  [{ gap: 600, y: ALTURA_ALTA }, { gap: 600, y: ALTURA_BAJA }],
  [{ gap: 500, y: ALTURA_BAJA }, { gap: 300, y: ALTURA_BAJA }, { gap: 300, y: ALTURA_BAJA }]
];

// ─── CANVAS ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");

// =============================================================================
// CLASE: ApiService  — toda la comunicación con el servidor
// =============================================================================
class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async enviarPuntuacion(nombre, puntos, dificultad) {
    try {
      const res = await fetch(`${this.baseUrl}/guardar-score`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, puntos, dificultad }),
      });
      await res.json();
    } catch (err) {
      console.error("Error al guardar puntuación:", err);
    }
  }

  async obtenerTopScores(dificultad) {
    try {
      const res = await fetch(`${this.baseUrl}/top-scores?dificultad=${dificultad}`);
      return await res.json();
    } catch (err) {
      console.error("Error al obtener ranking:", err);
      return [];
    }
  }

  async obtenerMiRecord(nombre, dificultad) {
    try {
      const res  = await fetch(`${this.baseUrl}/mi-record?nombre=${encodeURIComponent(nombre)}&dificultad=${dificultad}`);
      const data = await res.json();
      return data.record || 0;
    } catch (err) {
      console.error("Error al sincronizar récord:", err);
      return 0;
    }
  }
}

// =============================================================================
// CLASE: AudioManager  — música de fondo y botón mute
// =============================================================================
class AudioManager {
  constructor(src) {
    this.musicaFondo     = new Audio(src);
    this.musicaFondo.loop   = true;
    this.musicaFondo.volume = 0.5;
    this.encendida = localStorage.getItem("musicaVaquero") === "true";
  }

  toggle() {
    this.encendida = !this.encendida;
    localStorage.setItem("musicaVaquero", this.encendida);
    this.encendida ? this.musicaFondo.play() : this.musicaFondo.pause();
  }

  intentarReproducir() {
    if (this.encendida && this.musicaFondo.paused) {
      this.musicaFondo.play().catch(() => {});
    }
  }

  dibujarBoton() {
    const x    = canvas.width - 45;
    const y    = 15;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = COLOR_TINTA;
    ctx.fillStyle   = COLOR_TINTA;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    // Cuerpo del altavoz
    ctx.beginPath();
    ctx.rect(0, 10, 8, 10);
    ctx.moveTo(8, 10);
    ctx.lineTo(18, 2);
    ctx.lineTo(18, 28);
    ctx.lineTo(8, 20);
    ctx.fill();
    ctx.stroke();

    if (this.encendida) {
      ctx.beginPath();
      ctx.arc(15, 15, 8,  -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(15, 15, 14, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(22, 10); ctx.lineTo(32, 20);
      ctx.moveTo(32, 10); ctx.lineTo(22, 20);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// =============================================================================
// CLASE: Personaje  — física y dibujo del vaquero
// =============================================================================
class Personaje {
  constructor() {
    this.x        = 50;
    this.y        = 300;
    this.ancho    = 50;
    this.alto     = 40;
    this.dy       = 0;
    this.saltoFuerza = 18;
    this.gravedad = 0.7;
    this.enSuelo  = false;
  }

  reset() {
    this.y       = 300;
    this.dy      = 0;
    this.enSuelo = false;
  }

  aplicarFisicas(teclaPulsada) {
    this.dy += (this.dy < 0 && !teclaPulsada)
      ? this.gravedad * 2
      : this.gravedad;

    this.y += this.dy;

    const suelo = SUELO_Y - this.alto;
    if (this.y >= suelo) {
      this.y       = suelo;
      this.dy      = 0;
      this.enSuelo = true;
    }
  }

  dibujar(puntuacion, feedbackSaltoBloqueado) {
    const { x, y, ancho, alto } = this;

    ctx.save();

    let offsetX    = 0;
    let colorAlerta = null;

    if (feedbackSaltoBloqueado > 0) {
      offsetX     = (Math.random() - 0.5) * 8;
      colorAlerta = "rgba(255, 0, 0, 0.5)";
    }

    ctx.translate(offsetX, 0);

    // Poncho
    ctx.fillStyle = colorAlerta || "#A17F5B";
    ctx.fillRect(x, y, ancho, alto);

    // Franjas del poncho
    ctx.fillStyle = "rgba(62, 39, 35, 0.3)";
    ctx.fillRect(x, y + 15, ancho, 4);
    ctx.fillRect(x, y + 25, ancho, 3);

    // Chaleco
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
    ctx.fillRect(x + 5,           y + alto, 10, 10 + mov);
    ctx.fillRect(x + ancho - 15,  y + alto, 10, 10 - mov);

    ctx.restore();
  }
}

// =============================================================================
// CLASE: SistemaParticulas
// =============================================================================
class SistemaParticulas {
  constructor() {
    this.particulas = [];
  }

  reset() {
    this.particulas = [];
  }

  agregar(particula) {
    this.particulas.push(particula);
  }

  emitirSalto(x, y, ancho, alto) {
    for (let p = 0; p < 5; p++) {
      this.particulas.push({
        x:      x + ancho / 2 + (Math.random() - 0.5) * 20,
        y:      y + alto,
        vx:     (Math.random() - 0.5) * 2.5,
        vy:     Math.random() * 1.5 + 0.5,
        vida:   25 + Math.random() * 15,
        vidaMax: 40,
        radio:  1.5 + Math.random() * 1.5,
        color:  Math.random() > 0.5 ? "#C8A870" : "#D4B996",
      });
    }
  }

  emitirEsquive(obsX, obsY, obsAlto) {
    for (let p = 0; p < 6; p++) {
      this.particulas.push({
        x:      60 + Math.random() * 20,
        y:      obsY + obsAlto / 2 + (Math.random() - 0.5) * 20,
        vx:     (Math.random() - 0.3) * 3,
        vy:     (Math.random() - 0.5) * 2.5,
        vida:   35 + Math.random() * 20,
        vidaMax: 55,
        radio:  2 + Math.random() * 2,
        color:  Math.random() > 0.5 ? "#FFD700" : "#FAD7A0",
      });
    }
  }

  actualizarYDibujar() {
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const p = this.particulas[i];
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.12;
      p.vida--;

      if (p.vida <= 0) { this.particulas.splice(i, 1); continue; }

      const alpha = p.vida / p.vidaMax;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radio * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// =============================================================================
// CLASE: Renderer  — todo lo que dibuja en canvas (fondo, HUD, menús, ranking)
// =============================================================================
class Renderer {
  constructor(ctx, canvas) {
    this.ctx    = ctx;
    this.canvas = canvas;
    // Geometría del slider
    this.SLIDER = {
      x: 200, y: 280, ancho: 400, alto: 12, btnR: 10,
      min: 1,  max: 50,
      thumbX(incrementoExtremo) {
        return this.x + ((incrementoExtremo - this.min) / (this.max - this.min)) * this.ancho;
      },
    };
  }

  pintarFondo(puntuacion, modoDificil) {
    const w   = this.canvas.width;
    const h   = this.canvas.height;
    const ctx = this.ctx;

    // Cielo
    const gradCielo = ctx.createLinearGradient(0, 0, 0, SUELO_Y);
    gradCielo.addColorStop(0,   "#E8C98A");
    gradCielo.addColorStop(0.6, "#FAD7A0");
    gradCielo.addColorStop(1,   "#F5C97A");
    ctx.fillStyle = gradCielo;
    ctx.fillRect(0, 0, w, SUELO_Y);

    // Sol
    ctx.beginPath(); ctx.arc(680, 55, 32, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 200, 80, 0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(680, 55, 22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 210, 100, 0.55)"; ctx.fill();
    ctx.beginPath(); ctx.arc(680, 55, 14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 220, 120, 0.8)"; ctx.fill();

    // Montañas
    const offsetMont = (puntuacion * 0.4) % w;
    ctx.fillStyle = "rgba(180, 130, 90, 0.25)";
    for (let rep = 0; rep < 2; rep++) {
      const ox = -offsetMont + rep * w;
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

    // Cactus lejanos y medios
    this._dibujarCapaCactus((puntuacion * 1.2) % w, 0.18, SUELO_Y, 0.6);
    this._dibujarCapaCactus((puntuacion * 2.8) % w, 0.38, SUELO_Y, 0.9);

    // Suelo
    const gradSuelo = ctx.createLinearGradient(0, SUELO_Y, 0, h);
    gradSuelo.addColorStop(0,   "#5D3A1A");
    gradSuelo.addColorStop(0.3, "#3E2723");
    gradSuelo.addColorStop(1,   "#2A1A10");
    ctx.fillStyle = gradSuelo;
    ctx.fillRect(0, SUELO_Y, w, h - SUELO_Y);

    ctx.fillStyle = "rgba(100, 60, 20, 0.6)";
    ctx.fillRect(0, SUELO_Y, w, 3);

    const velocidadEfecto = modoDificil ? 14 : 9;
    const offsetSuelo = (puntuacion * velocidadEfecto) % 120;
    ctx.fillStyle = "rgba(250, 215, 160, 0.15)";
    for (let i = 0; i < w + 120; i += 120) {
      ctx.fillRect(w - i + offsetSuelo, 372, 55, 2);
    }
    ctx.fillStyle = "rgba(250, 215, 160, 0.07)";
    const offsetSuelo2 = (puntuacion * velocidadEfecto * 0.6) % 80;
    for (let i = 0; i < w + 80; i += 80) {
      ctx.fillRect(w - i + offsetSuelo2, 385, 30, 1);
    }
  }

  _dibujarCapaCactus(offsetX, escala, baseY, alpha) {
    const posiciones = [80, 260, 430, 650, 750];
    this.ctx.fillStyle = `rgba(62, 39, 35, ${alpha * 0.35})`;
    posiciones.forEach((px) => {
      for (let rep = 0; rep < 2; rep++) {
        const x = ((px - offsetX + rep * this.canvas.width) % this.canvas.width + this.canvas.width) % this.canvas.width;
        this._dibujarCactus(x, baseY, escala);
      }
    });
  }

  _dibujarCactus(cx, baseY, escala) {
    const u = Math.max(2, Math.round(8 * escala));
    const ctx = this.ctx;
    ctx.fillRect(cx - u,     baseY - u * 8, u * 2, u * 8);
    ctx.fillRect(cx - u * 4, baseY - u * 6, u * 3, u);
    ctx.fillRect(cx - u * 4, baseY - u * 8, u,     u * 2);
    ctx.fillRect(cx + u,     baseY - u * 5, u * 3, u);
    ctx.fillRect(cx + u * 3, baseY - u * 7, u,     u * 2);
  }

  dibujarBalas(obstaculos) {
    obstaculos.forEach((obs) => {
      // Cuerpo dorado
      this.ctx.fillStyle = "#FFD700";
      this.ctx.fillRect(obs.x + 10, obs.y, obs.ancho - 10, obs.alto);
      // Brillo
      this.ctx.fillStyle = "#FFF176";
      this.ctx.fillRect(obs.x + 10, obs.y, obs.ancho - 10, obs.alto / 3);
      // Sombra
      this.ctx.fillStyle = "#B8860B";
      this.ctx.fillRect(obs.x + 10, obs.y + (obs.alto * 2 / 3), obs.ancho - 10, obs.alto / 3);
      // Culote
      this.ctx.fillStyle = COLOR_TINTA;
      this.ctx.fillRect(obs.x + obs.ancho - 3, obs.y, 3, obs.alto);
      // Punta de plomo
      this.ctx.fillStyle = "#546E7A";
      this.ctx.beginPath();
      this.ctx.moveTo(obs.x + 10, obs.y);
      this.ctx.lineTo(obs.x,      obs.y + obs.alto / 2);
      this.ctx.lineTo(obs.x + 10, obs.y + obs.alto);
      this.ctx.fill();
    });
  }

  dibujarTelegrafiarBala(modoDificil, telegrafiarTimer, TELEGRAFIAR_FRAMES) {
    if (!modoDificil || telegrafiarTimer <= 0) return;

    const pulso = Math.sin((TELEGRAFIAR_FRAMES - telegrafiarTimer) * 0.25) * 0.5 + 0.5;
    const alpha = 0.3 + pulso * 0.7;
    const ancho = 18 + pulso * 12;
    const h     = this.canvas.height;
    const ctx   = this.ctx;

    ctx.save();
    ctx.globalAlpha = alpha;

    const grad = ctx.createLinearGradient(this.canvas.width - ancho, 0, this.canvas.width, 0);
    grad.addColorStop(0, "rgba(255, 80, 30, 0)");
    grad.addColorStop(1, "rgba(255, 80, 30, 0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(this.canvas.width - ancho, 0, ancho, h);

    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle   = "#FFD700";
    ctx.font        = `bold ${14 + Math.round(pulso * 6)}px ${FUENTE}`;
    ctx.textAlign   = "right";
    ctx.fillText("►", this.canvas.width - 6, 345);

    ctx.globalAlpha = alpha;
    ctx.fillStyle   = "#FF4500";
    ctx.font        = `bold 13px ${FUENTE}`;
    ctx.textAlign   = "right";
    ctx.fillText("¡ESQUIVA!", this.canvas.width - 8, 75);

    ctx.restore();
  }

  dibujarMensajeRacha(mensajeRacha, mensajeRachaTimer) {
    if (mensajeRachaTimer <= 0) return;

    const alpha  = Math.min(1, mensajeRachaTimer / 30);
    const escala = mensajeRachaTimer > 90
      ? 1 + (mensajeRachaTimer - 90) / 30 * 0.3
      : 1;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign   = "center";
    ctx.font        = `bold ${Math.round(22 * escala)}px ${FUENTE}`;
    ctx.fillStyle   = "#8B4513";
    ctx.shadowColor = "rgba(255, 200, 80, 0.8)";
    ctx.shadowBlur  = 8;
    ctx.fillText(mensajeRacha, this.canvas.width / 2, 80);
    ctx.restore();
  }

  dibujarPuntuacion(puntuacion, modoDificil, recordNormal, recordExtremo, rachaExtremo, incrementoExtremo) {
    const ctx = this.ctx;
    ctx.fillStyle = COLOR_TINTA;
    ctx.font      = `bold 20px ${FUENTE}`;

    ctx.textAlign = "left";
    ctx.fillText(`PUNTOS: ${puntuacion}`, 20, 40);

    const recordAMostrar = modoDificil ? recordExtremo : recordNormal;
    ctx.textAlign = "right";
    ctx.fillText(`MÁXIMA: ${recordAMostrar}`, this.canvas.width - 20, 40);

    if (modoDificil) {
      const velActual = 5 + Math.floor(puntuacion / incrementoExtremo);
      ctx.textAlign = "left";
      ctx.font      = `14px ${FUENTE}`;
      ctx.fillStyle = "rgba(62, 39, 35, 0.6)";
      ctx.fillText(`VEL: ${velActual}`, 20, 58);

      if (rachaExtremo > 0) {
        ctx.textAlign = "right";
        ctx.fillText(`RACHA: ${rachaExtremo}`, this.canvas.width - 20, 58);
      }
    }
  }

  dibujarMenuPrincipal(nombreJugador, modoDificil, modoSeleccionado, incrementoExtremo, audio) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = COLOR_ARENA;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = "center";
    ctx.fillStyle = COLOR_TINTA;
    ctx.font      = `bold 36px ${FUENTE}`;
    ctx.fillText("ELIGE TU DESTINO", this.canvas.width / 2, 45);

    ctx.font      = `16px ${FUENTE}`;
    ctx.fillStyle = "rgba(62, 39, 35, 0.6)";
    ctx.fillText(`✦ ${nombreJugador.toUpperCase()} ✦`, this.canvas.width / 2, 70);

    // Botón NORMAL
    ctx.lineWidth   = 4;
    ctx.strokeStyle = COLOR_TINTA;
    ctx.fillStyle   = !modoDificil ? COLOR_TINTA : "rgba(62, 39, 35, 0.1)";
    ctx.strokeRect(200, 90, 400, 55);
    ctx.fillRect(200, 90, 400, 55);
    ctx.fillStyle = !modoDificil ? COLOR_ARENA : COLOR_TINTA;
    ctx.font      = `bold 22px ${FUENTE}`;
    ctx.fillText("MODO NORMAL", this.canvas.width / 2, 126);

    // Botón EXTREMO
    ctx.fillStyle = modoDificil ? COLOR_TINTA : "rgba(62, 39, 35, 0.1)";
    ctx.strokeRect(200, 160, 400, 55);
    ctx.fillRect(200, 160, 400, 55);
    ctx.fillStyle = modoDificil ? COLOR_ARENA : COLOR_TINTA;
    ctx.font      = `bold 22px ${FUENTE}`;
    ctx.fillText("MODO EXTREMO", this.canvas.width / 2, 196);

    ctx.fillStyle = COLOR_TINTA;
    ctx.font      = `16px ${FUENTE}`;
    ctx.fillText(
      modoSeleccionado
        ? "── PULSA ENTER, ESPACIO O CLIC PARA JUGAR ──"
        : "Haz clic en un modo para seleccionarlo",
      this.canvas.width / 2,
      235
    );

    if (modoDificil) this.dibujarSliderExtremo(incrementoExtremo);
    audio.dibujarBoton();
  }

  dibujarSliderExtremo(incrementoExtremo) {
    const { x, y, ancho, alto, btnR } = this.SLIDER;
    const tx  = this.SLIDER.thumbX(incrementoExtremo);
    const ctx = this.ctx;

    ctx.textAlign = "center";
    ctx.fillStyle = COLOR_TINTA;
    ctx.font      = `bold 13px ${FUENTE}`;
    ctx.fillText("VELOCIDAD DE ACELERACIÓN — MODO EXTREMO", this.canvas.width / 2, y - 18);

    ctx.font      = `11px ${FUENTE}`;
    ctx.textAlign = "left";
    ctx.fillText("MÁS RÁPIDO", x, y - 5);
    ctx.textAlign = "right";
    ctx.fillText("MÁS LENTO", x + ancho, y - 5);

    // Track izquierda
    ctx.fillStyle = COLOR_TINTA;
    ctx.fillRect(x, y, tx - x, alto);
    // Track derecha
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

    // Valor numérico
    ctx.fillStyle = COLOR_TINTA;
    ctx.font      = `bold 14px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.fillText(incrementoExtremo, tx, y + alto + 20);
  }

  dibujarRanking(puntuacion, modoDificil, recordNormal, recordExtremo, listaTopScores, puedeReiniciar) {
    const ctx       = this.ctx;
    const margin    = this.canvas.width * 0.05;
    const tablaAncho = this.canvas.width * 0.9;
    const tablaX    = margin;

    // Pergamino
    ctx.fillStyle   = "rgba(250, 215, 160, 0.98)";
    ctx.fillRect(tablaX, 10, tablaAncho, 380);
    ctx.strokeStyle = COLOR_TINTA;
    ctx.lineWidth   = 4;
    ctx.strokeRect(tablaX, 10, tablaAncho, 380);

    ctx.fillStyle = COLOR_TINTA;
    ctx.textAlign = "center";

    // Puntuación final
    ctx.font = `bold 16px ${FUENTE}`;
    ctx.fillText("PUNTUACIÓN FINAL", this.canvas.width / 2, 35);
    ctx.font = `bold 32px ${FUENTE}`;
    ctx.fillText(puntuacion, this.canvas.width / 2, 70);

    // ¿Nuevo récord?
    const recordActual = modoDificil ? recordExtremo : recordNormal;
    const tieneRecord  = puntuacion >= recordActual && puntuacion > 0;
    if (tieneRecord) {
      ctx.font      = `bold 14px ${FUENTE}`;
      ctx.fillStyle = "#8B4513";
      ctx.fillText("⭐ ¡NUEVO RÉCORD! ⭐", this.canvas.width / 2, 92);
      ctx.fillStyle = COLOR_TINTA;
    }

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

    ctx.font = `bold 15px ${FUENTE}`;
    listaTopScores.slice(0, 5).forEach((score, index) => {
      const yPos        = yTablaStart + 35 + index * 28;
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

    // Frase motivadora
    const yFinalTabla = yTablaStart + 40 + (listaTopScores.slice(0, 5).length * 28);
    ctx.save();
    ctx.textAlign = "center";
    if (puntuacion < (modoDificil ? recordExtremo : recordNormal)) {
      ctx.fillStyle = COLOR_TINTA;
      ctx.font      = "bold 16px 'Courier Prime'";
      const frase   = FRASES_DERROTA[puntuacion % FRASES_DERROTA.length];
      ctx.fillText(frase, this.canvas.width / 2, yFinalTabla + 25);
    }
    ctx.restore();

    // Botón de reinicio
    ctx.textAlign = "center";
    ctx.font      = `bold 18px ${FUENTE}`;
    ctx.fillText(puedeReiniciar ? "CLIC PARA REINTENTAR" : "⌛ REGISTRANDO...", this.canvas.width / 2, 375);
  }

  // Pantalla que se muestra inmediatamente al morir, antes de que llegue el ranking
  dibujarPantallaMuerte(puntuacion, framesMuerte) {
    const ctx = this.ctx;
    const w   = this.canvas.width;
    const h   = this.canvas.height;

    // Fondo rojo desvanecido que aparece y luego se estabiliza
    const alphaFondo = Math.min(1, framesMuerte / 30);
    ctx.save();
    ctx.globalAlpha = alphaFondo * 0.55;
    ctx.fillStyle   = "#3E1010";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Pergamino central que aparece con fade-in
    const alphaTexto = Math.min(1, (framesMuerte - 10) / 25);
    if (alphaTexto <= 0) return;

    ctx.save();
    ctx.globalAlpha = alphaTexto;

    // Caja pergamino
    ctx.fillStyle   = "rgba(250, 215, 160, 0.96)";
    ctx.fillRect(150, 120, w - 300, 165);
    ctx.strokeStyle = COLOR_TINTA;
    ctx.lineWidth   = 4;
    ctx.strokeRect(150, 120, w - 300, 165);

    ctx.fillStyle = COLOR_TINTA;
    ctx.textAlign = "center";

    // Calavera animada (parpadeo lento)
    const parpadeo = Math.floor(framesMuerte / 12) % 2 === 0 ? "💀" : "✝";
    ctx.font = `bold 28px ${FUENTE}`;
    ctx.fillText(parpadeo, w / 2, 162);

    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText("HAS CAÍDO, FORASTERO", w / 2, 198);

    ctx.font = `18px ${FUENTE}`;
    ctx.fillStyle = "rgba(62,39,35,0.7)";
    ctx.fillText(`PUNTUACIÓN: ${puntuacion}`, w / 2, 228);

    // Puntos de carga animados
    const puntos = ".".repeat((Math.floor(framesMuerte / 15) % 4));
    ctx.font      = `14px ${FUENTE}`;
    ctx.fillStyle = "rgba(62,39,35,0.5)";
    ctx.fillText(`CONSULTANDO EL REGISTRO${puntos}`, w / 2, 266);

    ctx.restore();
  }

  dibujarCargando() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = COLOR_ARENA;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = COLOR_TINTA;
    this.ctx.font      = `bold 24px ${FUENTE}`;
    this.ctx.textAlign = "center";
    this.ctx.fillText("CARGANDO RÉCORD...", this.canvas.width / 2, this.canvas.height / 2);
  }
}

// =============================================================================
// CLASE: GestorObstaculos  — creación y lógica de balas
// =============================================================================
class GestorObstaculos {
  constructor() {
    this.obstaculos        = [];
    this.colaPatron        = [];
    this.distanciaUltima   = 0;
    this.telegrafiarTimer  = 0;
    this.TELEGRAFIAR_FRAMES = 80;
    this.saltoDisponibleExtremo = false;
  }

  reset() {
    this.obstaculos              = [];
    this.colaPatron              = [];
    this.distanciaUltima         = 0;
    this.telegrafiarTimer        = 0;
    this.saltoDisponibleExtremo  = false;
  }

  actualizar(puntuacion, modoDificil, incrementoExtremo, personaje) {
    const incremento = modoDificil ? incrementoExtremo : 500;
    const vActual    = 5 + Math.floor(puntuacion / incremento);

    if (!modoDificil) {
      this._actualizarNormal(vActual);
    } else {
      this._actualizarExtremo(vActual, personaje);
    }
  }

  _actualizarNormal(vActual) {
    this.distanciaUltima += vActual;

    if (this.colaPatron.length === 0) {
      if (this.distanciaUltima > 1200) {
        const indice    = Math.floor(Math.random() * PATRONES_NORMAL.length);
        this.colaPatron = JSON.parse(JSON.stringify(PATRONES_NORMAL[indice]));
        this.distanciaUltima = 0;
      }
      return;
    }

    if (this.distanciaUltima >= this.colaPatron[0].gap) {
      const infoBala = this.colaPatron.shift();
      this.obstaculos.push({
        x:        canvas.width,
        y:        infoBala.y,
        ancho:    30,
        alto:     10,
        velocidad: vActual,
        pasada:   false
      });
      this.distanciaUltima = 0;
    }
  }

  _actualizarExtremo(vActual, personaje) {
    if (this.obstaculos.length === 0 && this.telegrafiarTimer === 0 && personaje.enSuelo) {
      if (Math.random() < 0.05) {
        this.telegrafiarTimer       = this.TELEGRAFIAR_FRAMES;
        this.saltoDisponibleExtremo = true;
      }
    }
    if (this.telegrafiarTimer > 0) {
      this.telegrafiarTimer--;
      if (this.telegrafiarTimer === 0 && this.obstaculos.length === 0) {
        this.obstaculos.push({
          x:        canvas.width,
          y:        ALTURA_BAJA,
          ancho:    30,
          alto:     10,
          velocidad: vActual,
          pasada:   false
        });
      }
    }
  }

  moverYColisionar(personaje, particulas, onColision, onEsquive) {
    // Margen horizontal para dar algo de "justicia" al jugador
    const MARGEN_X = 20;
    // Sin margen vertical: las balas altas deben detectarse con precisión total
    const MARGEN_Y = 2;

    for (let i = this.obstaculos.length - 1; i >= 0; i--) {
      const obs       = this.obstaculos[i];
      const xAnterior = obs.x;
      obs.x -= obs.velocidad;

      // Comprobamos tanto la posición anterior como la actual para no
      // "saltarnos" una bala rápida en un solo frame (tunnel effect)
      const colision =
        personaje.x + MARGEN_X < xAnterior + obs.ancho &&
        personaje.x + personaje.ancho - MARGEN_X > obs.x &&
        personaje.y + MARGEN_Y < obs.y + obs.alto &&
        personaje.y + personaje.alto - MARGEN_Y > obs.y;

      if (colision) {
        onColision();
        return; // salimos inmediatamente; el estado ya está marcado
      }

      if (obs.x < -obs.ancho) {
        particulas.emitirEsquive(obs.x, obs.y, obs.alto);
        onEsquive();
        this.obstaculos.splice(i, 1);
      }
    }
  }
}

// =============================================================================
// CLASE: GestorRacha  — racha de esquives en modo Extremo
// =============================================================================
class GestorRacha {
  constructor() {
    this.racha      = 0;
    this.mensaje    = "";
    this.timer      = 0;
  }

  reset() {
    this.racha   = 0;
    this.mensaje = "";
    this.timer   = 0;
  }

  registrarEsquive() {
    this.racha++;
    const hitos  = [5, 10, 20, 30, 50];
    if (hitos.includes(this.racha)) {
      const textos = {
        5:  "¡5 ESQUIVADAS!",
        10: "¡10 ESQUIVADAS! ¡LEYENDA!",
        20: "¡20! ¡IMPARABLE!",
        30: "¡30! ¿ERES HUMANO?",
        50: "¡50! ¡EL DIABLO NO PUEDE CONTIGO!",
      };
      this.mensaje = textos[this.racha];
      this.timer   = 120;
    }
  }

  tickTimer() {
    if (this.timer > 0) this.timer--;
  }
}

// =============================================================================
// CLASE: InputManager  — teclado, ratón, touch
// =============================================================================
class InputManager {
  constructor(canvas, juego) {
    this.canvas        = canvas;
    this.juego         = juego;
    this.teclaPulsada  = false;
    this.arrastrando   = false;
    this._registrar();
  }

  _registrar() {
    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup",   (e) => { if (e.code === "Space") this.teclaPulsada = false; });
    window.addEventListener("pointerup", () => { this.teclaPulsada = false; });

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault(), false);
    this.canvas.addEventListener("touchstart",  (e) => { if (e.target === this.canvas) e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener("touchend",    (e) => { if (e.target === this.canvas) e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener("touchmove",   (e) => { if (e.target === this.canvas) e.preventDefault(); }, { passive: false });

    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.canvas.addEventListener("pointerup",   ()  => { this.arrastrando = false; });
  }

  _onKeyDown(e) {
    if (e.code === "Space") e.preventDefault();

    const j = this.juego;

    if (!j.juegoIniciado) {
      if (e.key === "1") { j.modoDificil = false; j.modoSeleccionado = true; j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio); return; }
      if (e.key === "2") { j.modoDificil = true;  j.modoSeleccionado = true; j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio); return; }

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (j.modoSeleccionado) {
          j.iniciarPartida();
        } else {
          j.modoDificil     = false;
          j.modoSeleccionado = true;
          j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        }
      }
      return;
    }

    if (j.juegoTerminado) {
      if ((e.code === "Space" || e.code === "KeyR") && j.puedeReiniciar) {
        j.reiniciar();
      }
      return;
    }

    if (e.code === "Space") {
      if (this.teclaPulsada) return;
      this.teclaPulsada = true;
      j.saltar();
    }
  }

  _onPointerDown(e) {
    const { clickX, clickY } = this._escalar(e);
    const j = this.juego;

    // Botón de música
    const esClicEnMute = (clickX > this.canvas.width - 60 && clickY < 50);
    j.audio.intentarReproducir();

    if (esClicEnMute) {
      j.audio.toggle();
      if (!j.juegoIniciado) j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
      return;
    }

    if (!j.juegoIniciado) {
      // Slider
      if (j.modoDificil && j.modoSeleccionado) {
        const sl = j.renderer.SLIDER;
        const enTrack = clickX >= sl.x - sl.btnR && clickX <= sl.x + sl.ancho + sl.btnR &&
                        clickY >= sl.y - sl.btnR && clickY <= sl.y + sl.alto + sl.btnR + 20;
        if (enTrack) {
          this.arrastrando = true;
          this.canvas.setPointerCapture(e.pointerId);
          const ratio = Math.max(0, Math.min(1, (clickX - sl.x) / sl.ancho));
          j.incrementoExtremo = Math.round(sl.min + ratio * (sl.max - sl.min));
          j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
          return;
        }
      }

      const enNormal  = clickX >= 200 && clickX <= 600 && clickY >= 90  && clickY <= 145;
      const enExtremo = clickX >= 200 && clickX <= 600 && clickY >= 160 && clickY <= 215;

      if (enNormal) {
        if (j.modoSeleccionado && !j.modoDificil) {
          j.iniciarPartida();
        } else {
          j.modoDificil      = false;
          j.modoSeleccionado = true;
          j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        }
        return;
      } else if (enExtremo) {
        if (j.modoSeleccionado && j.modoDificil) {
          j.iniciarPartida();
        } else {
          j.modoDificil      = true;
          j.modoSeleccionado = true;
          j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        }
        return;
      }
    }

    if (j.juegoTerminado) {
      if (j.puedeReiniciar) j.reiniciar();
      return;
    }

    j.saltar();
  }

  _onPointerMove(e) {
    if (!this.arrastrando) return;
    const { clickX } = this._escalar(e);
    const j  = this.juego;
    const sl = j.renderer.SLIDER;
    const ratio = Math.max(0, Math.min(1, (clickX - sl.x) / sl.ancho));
    j.incrementoExtremo = Math.round(sl.min + ratio * (sl.max - sl.min));
    j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
  }

  _escalar(e) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      clickX: (e.clientX - rect.left) * scaleX,
      clickY: (e.clientY - rect.top)  * scaleY,
    };
  }
}

// =============================================================================
// CLASE PRINCIPAL: Juego
// =============================================================================
class Juego {
  constructor() {
    // ── Servicios ──────────────────────────────────────────────────────────
    this.api       = new ApiService(API_BASE);
    this.audio     = new AudioManager("resources/cancion2.mp3");
    this.renderer  = new Renderer(ctx, canvas);
    this.particulas = new SistemaParticulas();
    this.personaje  = new Personaje();
    this.obstaculos = new GestorObstaculos();
    this.racha      = new GestorRacha();
    this.input      = new InputManager(canvas, this);

    // ── Estado ─────────────────────────────────────────────────────────────
    this.juegoIniciado    = false;
    this.juegoTerminado   = false;
    this.modoDificil      = false;
    this.modoSeleccionado = false;
    this.puedeReiniciar   = false;
    this.puntuacion       = 0;
    this.incrementoExtremo = 25;
    this.feedbackSaltoBloqueado = 0;
    this.framesMuerte     = 0;   // frames desde la muerte, para la animación de transición
    this.listaTopScores   = [];

    // ── Récords ────────────────────────────────────────────────────────────
    this.recordNormal  = parseInt(localStorage.getItem("record_Normal"),  10) || 0;
    this.recordExtremo = parseInt(localStorage.getItem("record_Extremo"), 10) || 0;

    // ── Nombre ─────────────────────────────────────────────────────────────
    this.nombreJugador = this._obtenerNombre();

    // ── Arranque ───────────────────────────────────────────────────────────
    this._loop();
  }

  _obtenerNombre() {
    const guardado = localStorage.getItem("vaqueroNombre");
    if (guardado) return guardado;
    const input  = prompt("Introduce tu nombre de vaquero:");
    const nombre = input && input.trim() !== ""
      ? input.trim()
      : "Forastero#" + Math.floor(Math.random() * 9000 + 1000);
    localStorage.setItem("vaqueroNombre", nombre);
    return nombre;
  }

  // ─── API ─────────────────────────────────────────────────────────────────
  async _registrarMuerte() {
    const dificultad = this.modoDificil ? "Extremo" : "Normal";
    await this.api.enviarPuntuacion(this.nombreJugador, this.puntuacion, dificultad);
    this.listaTopScores = await this.api.obtenerTopScores(dificultad);
    this.puedeReiniciar = true;
  }

  async _sincronizarRecord() {
    const dificultad = this.modoDificil ? "Extremo" : "Normal";
    const record     = await this.api.obtenerMiRecord(this.nombreJugador, dificultad);
    if (this.modoDificil) {
      this.recordExtremo = record;
      localStorage.setItem("record_Extremo", record);
    } else {
      this.recordNormal = record;
      localStorage.setItem("record_Normal", record);
    }
  }

  // ─── SALTO ───────────────────────────────────────────────────────────────
  saltar() {
    if (!this.personaje.enSuelo) return;

    if (this.modoDificil) {
      if (!this.obstaculos.saltoDisponibleExtremo) {
        this.feedbackSaltoBloqueado = 10;
        return;
      }
      this.obstaculos.saltoDisponibleExtremo = false;
    }

    this.personaje.dy       = -this.personaje.saltoFuerza;
    this.personaje.enSuelo  = false;
    this.input.teclaPulsada = true;
    this.particulas.emitirSalto(this.personaje.x, this.personaje.y, this.personaje.ancho, this.personaje.alto);
  }

  // ─── INICIO Y REINICIO ───────────────────────────────────────────────────
  async iniciarPartida() {
    this.renderer.dibujarCargando();
    await this._sincronizarRecord();
    this.api.obtenerTopScores(this.modoDificil ? "Extremo" : "Normal"); // precarga
    this.juegoIniciado = true;
    this._loop();
  }

  reiniciar() {
    this.juegoIniciado    = false;
    this.juegoTerminado   = false;
    this.puntuacion       = 0;
    this.puedeReiniciar   = false;
    this.feedbackSaltoBloqueado = 0;
    this.framesMuerte     = 0;
    this.listaTopScores   = [];
    this.modoSeleccionado = this.modoDificil; // si era difícil, queda seleccionado

    this.particulas.reset();
    this.personaje.reset();
    this.obstaculos.reset();
    this.racha.reset();

    this.renderer.dibujarMenuPrincipal(
      this.nombreJugador, this.modoDificil,
      this.modoSeleccionado, this.incrementoExtremo, this.audio
    );
  }

  // ─── ACTUALIZAR RÉCORD LOCAL ─────────────────────────────────────────────
  _actualizarRecord() {
    const recordActual = this.modoDificil ? this.recordExtremo : this.recordNormal;
    if (this.puntuacion > recordActual) {
      if (this.modoDificil) this.recordExtremo = this.puntuacion;
      else                  this.recordNormal  = this.puntuacion;
    }
  }

  // ─── LOOP PRINCIPAL ──────────────────────────────────────────────────────
  _loop() {
    if (!this.juegoIniciado) {
      this.renderer.dibujarMenuPrincipal(
        this.nombreJugador, this.modoDificil,
        this.modoSeleccionado, this.incrementoExtremo, this.audio
      );
      return;
    }

    if (this.juegoTerminado) {
      this.framesMuerte++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!this.puedeReiniciar) {
        // Todavía esperando respuesta del servidor: fondo congelado + pantalla de muerte
        this.renderer.pintarFondo(this.puntuacion, this.modoDificil);
        this.personaje.dibujar(this.puntuacion, 0);
        this.renderer.dibujarBalas(this.obstaculos.obstaculos);
        this.renderer.dibujarPantallaMuerte(this.puntuacion, this.framesMuerte);
      } else {
        // Ya tenemos los datos: mostrar ranking completo
        this.renderer.dibujarRanking(
          this.puntuacion, this.modoDificil,
          this.recordNormal, this.recordExtremo,
          this.listaTopScores, this.puedeReiniciar
        );
      }

      requestAnimationFrame(() => this._loop());
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.renderer.pintarFondo(this.puntuacion, this.modoDificil);
    this.personaje.aplicarFisicas(this.input.teclaPulsada);

    // Reducir feedback de bloqueo
    if (this.feedbackSaltoBloqueado > 0) this.feedbackSaltoBloqueado--;

    // Actualizar obstáculos
    this.obstaculos.actualizar(
      this.puntuacion, this.modoDificil,
      this.incrementoExtremo, this.personaje
    );

    // Colisiones y esquives
    this.obstaculos.moverYColisionar(
      this.personaje,
      this.particulas,
      () => {
        // onColision
        if (!this.juegoTerminado) {
          this.juegoTerminado = true;
          this.racha.reset();
          if (navigator.vibrate) navigator.vibrate(100);
          this._registrarMuerte();
        }
      },
      () => {
        // onEsquive
        if (this.modoDificil) {
          this.racha.registrarEsquive();
        }
      }
    );

    // Dibujar
    this.personaje.dibujar(this.puntuacion, this.feedbackSaltoBloqueado);
    this.renderer.dibujarBalas(this.obstaculos.obstaculos);
    this.particulas.actualizarYDibujar();
    this.renderer.dibujarTelegrafiarBala(
      this.modoDificil,
      this.obstaculos.telegrafiarTimer,
      this.obstaculos.TELEGRAFIAR_FRAMES
    );

    this.racha.tickTimer();
    this.renderer.dibujarMensajeRacha(this.racha.mensaje, this.racha.timer);

    this._actualizarRecord();
    this.renderer.dibujarPuntuacion(
      this.puntuacion, this.modoDificil,
      this.recordNormal, this.recordExtremo,
      this.racha.racha, this.incrementoExtremo
    );

    this.puntuacion++;
    requestAnimationFrame(() => this._loop());
  }
}

// =============================================================================
// ARRANQUE
// =============================================================================
const juego = new Juego();