/**
 * @fileoverview VAQUERO RUNNER — script.js (Refactorizado a OOP con JSDoc)
 * Motor de juego refactorizado bajo el paradigma de Programación Orientada a Objetos.
 * Gestiona físicas, renderizado, comunicación con API, audio y eventos de entrada.
 */

// ─── CONSTANTES GLOBALES ─────────────────────────────────────────────────────

/**
 * Lista de frases aleatorias que se muestran en la pantalla de Game Over.
 * @constant {string[]}
 */
const FRASES_DERROTA = [
  "¡VUELVE A LA SILLA, VAQUERO!",
  "EL DESIERTO NO PERDONA...",
  "¡CASI DESENFUNDAS A TIEMPO!",
  "ESA BALA TENÍA TU NOMBRE...",
  "NI EL MÁS RÁPIDO VIVE SIEMPRE.",
  "¡RECARGA Y VUELVE A INTENTARLO!",
  "HAS MUERTO CON LAS BOTAS PUESTAS.",
];

/** @constant {string} API_BASE - URL del servidor backend. */
const API_BASE = "https://infiniterunner.onrender.com";

/** @constant {number} SUELO_Y - Coordenada Y donde se sitúa la línea del suelo. */
const SUELO_Y = 360;

/** @constant {string} FUENTE - Tipografía principal utilizada en el canvas. */
const FUENTE = "'Courier Prime', Courier, monospace";

/** @constant {string} COLOR_TINTA - Color principal oscuro (marrón/negro) para trazos y texto. */
const COLOR_TINTA = "#3E2723";

/** @constant {string} COLOR_ARENA - Color principal claro (arena) para el fondo. */
const COLOR_ARENA = "#FAD7A0";

/** @constant {number} ALTURA_BAJA - Coordenada Y para las balas a ras de suelo. */
const ALTURA_BAJA = SUELO_Y - 25;

/** @constant {number} ALTURA_ALTA - Coordenada Y para las balas aéreas. */
const ALTURA_ALTA = SUELO_Y - 85;

/**
 * Definición de secuencias rítmicas de balas para el Modo Normal.
 * Cada patrón contiene objetos con la distancia (gap) a la bala anterior y su altura (y).
 * @constant {Array<Array<{gap: number, y: number}>>}
 */
const PATRONES_NORMAL = [
  [
    { gap: 600, y: ALTURA_BAJA },
    { gap: 200, y: ALTURA_BAJA },
  ],
  [
    { gap: 700, y: ALTURA_BAJA },
    { gap: 250, y: ALTURA_ALTA },
  ],
  [
    { gap: 600, y: ALTURA_ALTA },
    { gap: 600, y: ALTURA_BAJA },
  ],
  [
    { gap: 500, y: ALTURA_BAJA },
    { gap: 300, y: ALTURA_BAJA },
    { gap: 300, y: ALTURA_BAJA },
  ],
];

// ─── CANVAS ──────────────────────────────────────────────────────────────────
/** @type {HTMLCanvasElement} Elemento canvas del DOM. */
const canvas = document.getElementById("gameCanvas");
/** @type {CanvasRenderingContext2D} Contexto 2D para renderizar. */
const ctx = canvas.getContext("2d");

// =============================================================================
// CLASE: ApiService
// =============================================================================
/**
 * Clase encargada de gestionar toda la comunicación HTTP con el servidor backend.
 */
class ApiService {
  /**
   * Crea una instancia del servicio de API.
   * @param {string} baseUrl - URL base del backend.
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Envía la puntuación obtenida por el jugador al servidor.
   * @param {string} nombre - Nombre del jugador.
   * @param {number} puntos - Puntuación alcanzada.
   * @param {string} dificultad - Nivel de dificultad ("Normal" o "Extremo").
   * @returns {Promise<void>}
   */
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

  /**
   * Obtiene la lista con las mejores puntuaciones según la dificultad.
   * @param {string} dificultad - Nivel de dificultad ("Normal" o "Extremo").
   * @returns {Promise<Array>} Retorna un array con el ranking, o array vacío si falla.
   */
  async obtenerTopScores(dificultad) {
    try {
      const res = await fetch(
        `${this.baseUrl}/top-scores?dificultad=${dificultad}`,
      );
      return await res.json();
    } catch (err) {
      console.error("Error al obtener ranking:", err);
      return [];
    }
  }

  /**
   * Consulta el récord personal de un jugador específico.
   * @param {string} nombre - Nombre del jugador.
   * @param {string} dificultad - Nivel de dificultad.
   * @returns {Promise<number>} Puntuación máxima del jugador, o 0 si no tiene récord.
   */
  async obtenerMiRecord(nombre, dificultad) {
    try {
      const res = await fetch(
        `${this.baseUrl}/mi-record?nombre=${encodeURIComponent(nombre)}&dificultad=${dificultad}`,
      );
      const data = await res.json();
      return data.record || 0;
    } catch (err) {
      console.error("Error al sincronizar récord:", err);
      return 0;
    }
  }
}

// =============================================================================
// CLASE: AudioManager
// =============================================================================
/**
 * Clase responsable de reproducir la música de fondo y manejar el estado (mute/unmute).
 */
class AudioManager {
  /**
   * Crea una instancia del gestor de audio.
   * @param {string} src - Ruta del archivo de audio.
   */
  constructor(src) {
    this.musicaFondo = new Audio(src);
    this.musicaFondo.loop = true;
    this.musicaFondo.volume = 0.5;
    this.encendida = localStorage.getItem("musicaVaquero") === "true";
  }

  /**
   * Alterna el estado de reproducción de la música (play/pause)
   * y guarda la preferencia en localStorage.
   */
  toggle() {
    this.encendida = !this.encendida;
    localStorage.setItem("musicaVaquero", this.encendida);
    this.encendida ? this.musicaFondo.play() : this.musicaFondo.pause();
  }

  /**
   * Intenta reanudar la música si está activada pero pausada
   * (útil para sortear las políticas de autoplay de los navegadores).
   */
  intentarReproducir() {
    if (this.encendida && this.musicaFondo.paused) {
      this.musicaFondo.play().catch(() => {});
    }
  }

  /**
   * Dibuja el icono del altavoz (activado o desactivado) en la esquina del canvas.
   */
  dibujarBoton() {
    const x = canvas.width - 45;
    const y = 15;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = COLOR_TINTA;
    ctx.fillStyle = COLOR_TINTA;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

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
      // Ondas de sonido activadas
      ctx.beginPath();
      ctx.arc(15, 15, 8, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(15, 15, 14, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    } else {
      // Cruz de silencio
      ctx.beginPath();
      ctx.moveTo(22, 10);
      ctx.lineTo(32, 20);
      ctx.moveTo(32, 10);
      ctx.lineTo(22, 20);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// =============================================================================
// CLASE: Personaje
// =============================================================================
/**
 * Representa al jugador (el vaquero).
 * Maneja sus dimensiones, físicas (salto y gravedad) y renderizado gráfico.
 */
class Personaje {
  /**
   * Inicializa al vaquero con sus valores físicos y posicionales por defecto.
   */
  constructor() {
    this.x = 50;
    this.y = 300;
    this.ancho = 50;
    this.alto = 40;
    this.dy = 0;
    this.saltoFuerza = 18;
    this.gravedad = 0.7;
    this.enSuelo = false;
  }

  /**
   * Restablece la posición y estado del personaje al inicio de una partida.
   */
  reset() {
    this.y = 300;
    this.dy = 0;
    this.enSuelo = false;
  }

  /**
   * Aplica la gravedad y gestiona la posición vertical.
   * Permite control variable de altura (si se suelta la tecla, cae más rápido).
   * @param {boolean} teclaPulsada - Indica si el usuario mantiene presionada la tecla de salto.
   */
  aplicarFisicas(teclaPulsada) {
    this.dy += this.dy < 0 && !teclaPulsada ? this.gravedad * 2 : this.gravedad;
    this.y += this.dy;

    const suelo = SUELO_Y - this.alto;
    if (this.y >= suelo) {
      this.y = suelo;
      this.dy = 0;
      this.enSuelo = true;
    }
  }

  /**
   * Dibuja al personaje en el canvas. Incluye la animación de piernas
   * y el feedback visual de temblor (rojo) si se bloquea un salto.
   * @param {number} puntuacion - Puntuación actual (usada para animar el trote).
   * @param {number} feedbackSaltoBloqueado - Frames restantes de temblor (0 si no aplica).
   */
  dibujar(puntuacion, feedbackSaltoBloqueado) {
    const { x, y, ancho, alto } = this;

    ctx.save();

    let offsetX = 0;
    let colorAlerta = null;

    if (feedbackSaltoBloqueado > 0) {
      offsetX = (Math.random() - 0.5) * 8;
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
    ctx.fillRect(x + 5, y + alto, 10, 10 + mov);
    ctx.fillRect(x + ancho - 15, y + alto, 10, 10 - mov);

    ctx.restore();
  }
}

// =============================================================================
// CLASE: SistemaParticulas
// =============================================================================
/**
 * Gestiona la colección de partículas para generar efectos visuales
 * (como polvo al saltar o chispas al esquivar).
 */
class SistemaParticulas {
  /**
   * Inicializa el array de partículas.
   */
  constructor() {
    this.particulas = [];
  }

  /**
   * Limpia todas las partículas activas.
   */
  reset() {
    this.particulas = [];
  }

  /**
   * Añade una partícula personalizada al sistema.
   * @param {Object} particula - Objeto con x, y, vx, vy, vida, etc.
   */
  agregar(particula) {
    this.particulas.push(particula);
  }

  /**
   * Genera polvo simulando el impulso del vaquero al saltar.
   * @param {number} x - Posición X del personaje.
   * @param {number} y - Posición Y del personaje.
   * @param {number} ancho - Ancho del personaje.
   * @param {number} alto - Alto del personaje.
   */
  emitirSalto(x, y, ancho, alto) {
    for (let p = 0; p < 5; p++) {
      this.particulas.push({
        x: x + ancho / 2 + (Math.random() - 0.5) * 20,
        y: y + alto,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 1.5 + 0.5,
        vida: 25 + Math.random() * 15,
        vidaMax: 40,
        radio: 1.5 + Math.random() * 1.5,
        color: Math.random() > 0.5 ? "#C8A870" : "#D4B996",
      });
    }
  }

  /**
   * Genera chispas metálicas cuando una bala sale de la pantalla exitosamente.
   * @param {number} obsX - Coordenada X del obstáculo.
   * @param {number} obsY - Coordenada Y del obstáculo.
   * @param {number} obsAlto - Altura del obstáculo.
   */
  emitirEsquive(obsX, obsY, obsAlto) {
    for (let p = 0; p < 6; p++) {
      this.particulas.push({
        x: 60 + Math.random() * 20,
        y: obsY + obsAlto / 2 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.3) * 3,
        vy: (Math.random() - 0.5) * 2.5,
        vida: 35 + Math.random() * 20,
        vidaMax: 55,
        radio: 2 + Math.random() * 2,
        color: Math.random() > 0.5 ? "#FFD700" : "#FAD7A0",
      });
    }
  }

  /**
   * Recorre las partículas, actualiza sus físicas (caída, desvanecimiento)
   * y las dibuja en el canvas. Destruye las partículas sin vida.
   */
  actualizarYDibujar() {
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const p = this.particulas[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vida--;

      if (p.vida <= 0) {
        this.particulas.splice(i, 1);
        continue;
      }

      const alpha = p.vida / p.vidaMax;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radio * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// =============================================================================
// CLASE: Renderer
// =============================================================================
/**
 * Clase responsable de pintar todos los escenarios, menús y UI del juego.
 * Extrae la lógica de dibujo complejo para mantener el Motor principal limpio.
 */
class Renderer {
  /**
   * Crea el motor de dibujado.
   * @param {CanvasRenderingContext2D} ctx - Contexto 2D del canvas.
   * @param {HTMLCanvasElement} canvas - Elemento canvas HTML.
   */
  constructor(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;

    /** @type {Object} Configuración geométrica del Slider (Modo Extremo). */
    this.SLIDER = {
      x: 200,
      y: 280,
      ancho: 400,
      alto: 12,
      btnR: 10,
      min: 1,
      max: 50,
      /**
       * Calcula la posición horizontal del cursor del slider.
       * @param {number} incrementoExtremo - Valor actual del parámetro.
       * @returns {number} Coordenada X del cursor.
       */
      thumbX(incrementoExtremo) {
        return (
          this.x +
          ((incrementoExtremo - this.min) / (this.max - this.min)) * this.ancho
        );
      },
    };
  }

  /**
   * Renderiza el entorno completo del desierto (cielo, sol, montañas, dunas y suelo).
   * Incorpora efecto de parallax usando la puntuación.
   * @param {number} puntuacion - Puntuación que dicta el desplazamiento global.
   * @param {boolean} modoDificil - Indica si es modo extremo (afecta la velocidad del suelo).
   */
  pintarFondo(puntuacion, modoDificil) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // Cielo
    const gradCielo = ctx.createLinearGradient(0, 0, 0, SUELO_Y);
    gradCielo.addColorStop(0, "#E8C98A");
    gradCielo.addColorStop(0.6, "#FAD7A0");
    gradCielo.addColorStop(1, "#F5C97A");
    ctx.fillStyle = gradCielo;
    ctx.fillRect(0, 0, w, SUELO_Y);

    // Sol
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

    // Montañas (Parallax Lento)
    const offsetMont = (puntuacion * 0.4) % w;
    ctx.fillStyle = "rgba(180, 130, 90, 0.25)";
    for (let rep = 0; rep < 2; rep++) {
      const ox = -offsetMont + rep * w;
      ctx.beginPath();
      ctx.moveTo(ox, SUELO_Y);
      ctx.lineTo(ox, 230);
      ctx.lineTo(ox + 80, 180);
      ctx.lineTo(ox + 160, 230);
      ctx.lineTo(ox + 220, 200);
      ctx.lineTo(ox + 310, 160);
      ctx.lineTo(ox + 400, 210);
      ctx.lineTo(ox + 480, 175);
      ctx.lineTo(ox + 560, 220);
      ctx.lineTo(ox + 640, 190);
      ctx.lineTo(ox + 720, 240);
      ctx.lineTo(ox + 800, SUELO_Y);
      ctx.closePath();
      ctx.fill();
    }

    // Cactus
    this._dibujarCapaCactus((puntuacion * 1.2) % w, 0.18, SUELO_Y, 0.6);
    this._dibujarCapaCactus((puntuacion * 2.8) % w, 0.38, SUELO_Y, 0.9);

    // Suelo
    const gradSuelo = ctx.createLinearGradient(0, SUELO_Y, 0, h);
    gradSuelo.addColorStop(0, "#5D3A1A");
    gradSuelo.addColorStop(0.3, "#3E2723");
    gradSuelo.addColorStop(1, "#2A1A10");
    ctx.fillStyle = gradSuelo;
    ctx.fillRect(0, SUELO_Y, w, h - SUELO_Y);

    ctx.fillStyle = "rgba(100, 60, 20, 0.6)";
    ctx.fillRect(0, SUELO_Y, w, 3);

    // Textura animada del suelo
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

  /**
   * Método interno para calcular el tileo de los cactus en parallax.
   * @param {number} offsetX - Desplazamiento actual.
   * @param {number} escala - Factor de tamaño.
   * @param {number} baseY - Posición Y base.
   * @param {number} alpha - Opacidad.
   * @private
   */
  _dibujarCapaCactus(offsetX, escala, baseY, alpha) {
    const posiciones = [80, 260, 430, 650, 750];
    this.ctx.fillStyle = `rgba(62, 39, 35, ${alpha * 0.35})`;
    posiciones.forEach((px) => {
      for (let rep = 0; rep < 2; rep++) {
        const x =
          (((px - offsetX + rep * this.canvas.width) % this.canvas.width) +
            this.canvas.width) %
          this.canvas.width;
        this._dibujarCactus(x, baseY, escala);
      }
    });
  }

  /**
   * Método interno para pintar un cactus individual (pixel art manual).
   * @param {number} cx - Coordenada X.
   * @param {number} baseY - Coordenada Y (Suelo).
   * @param {number} escala - Tamaño base.
   * @private
   */
  _dibujarCactus(cx, baseY, escala) {
    const u = Math.max(2, Math.round(8 * escala));
    const ctx = this.ctx;
    ctx.fillRect(cx - u, baseY - u * 8, u * 2, u * 8);
    ctx.fillRect(cx - u * 4, baseY - u * 6, u * 3, u);
    ctx.fillRect(cx - u * 4, baseY - u * 8, u, u * 2);
    ctx.fillRect(cx + u, baseY - u * 5, u * 3, u);
    ctx.fillRect(cx + u * 3, baseY - u * 7, u, u * 2);
  }

  /**
   * Pinta los proyectiles (balas) almacenados en el array del gestor.
   * @param {Array<Object>} obstaculos - Array de balas.
   */
  dibujarBalas(obstaculos) {
    obstaculos.forEach((obs) => {
      this.ctx.fillStyle = "#FFD700";
      this.ctx.fillRect(obs.x + 10, obs.y, obs.ancho - 10, obs.alto);
      this.ctx.fillStyle = "#FFF176";
      this.ctx.fillRect(obs.x + 10, obs.y, obs.ancho - 10, obs.alto / 3);
      this.ctx.fillStyle = "#B8860B";
      this.ctx.fillRect(
        obs.x + 10,
        obs.y + (obs.alto * 2) / 3,
        obs.ancho - 10,
        obs.alto / 3,
      );
      this.ctx.fillStyle = COLOR_TINTA;
      this.ctx.fillRect(obs.x + obs.ancho - 3, obs.y, 3, obs.alto);
      this.ctx.fillStyle = "#546E7A";
      this.ctx.beginPath();
      this.ctx.moveTo(obs.x + 10, obs.y);
      this.ctx.lineTo(obs.x, obs.y + obs.alto / 2);
      this.ctx.lineTo(obs.x + 10, obs.y + obs.alto);
      this.ctx.fill();
    });
  }

  /**
   * Renderiza el HUD visual de alerta en Modo Extremo antes de disparar.
   * @param {boolean} modoDificil - Si estamos en modo extremo.
   * @param {number} telegrafiarTimer - Frames restantes de alerta.
   * @param {number} TELEGRAFIAR_FRAMES - Constante máxima de duración.
   */
  dibujarTelegrafiarBala(modoDificil, telegrafiarTimer, TELEGRAFIAR_FRAMES) {
    if (!modoDificil || telegrafiarTimer <= 0) return;

    const pulso =
      Math.sin((TELEGRAFIAR_FRAMES - telegrafiarTimer) * 0.25) * 0.5 + 0.5;
    const alpha = 0.3 + pulso * 0.7;
    const ancho = 18 + pulso * 12;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = alpha;

    const grad = ctx.createLinearGradient(
      this.canvas.width - ancho,
      0,
      this.canvas.width,
      0,
    );
    grad.addColorStop(0, "rgba(255, 80, 30, 0)");
    grad.addColorStop(1, "rgba(255, 80, 30, 0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(this.canvas.width - ancho, 0, ancho, h);

    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = "#FFD700";
    ctx.font = `bold ${14 + Math.round(pulso * 6)}px ${FUENTE}`;
    ctx.textAlign = "right";
    ctx.fillText("►", this.canvas.width - 6, 345);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#FF4500";
    ctx.font = `bold 13px ${FUENTE}`;
    ctx.textAlign = "right";
    ctx.fillText("¡ESQUIVA!", this.canvas.width - 8, 75);

    ctx.restore();
  }

  /**
   * Dibuja el mensaje flotante de motivación (ej. "¡Racha de 5!").
   * @param {string} mensajeRacha - Texto a mostrar.
   * @param {number} mensajeRachaTimer - Frames restantes de opacidad.
   */
  dibujarMensajeRacha(mensajeRacha, mensajeRachaTimer) {
    if (mensajeRachaTimer <= 0) return;

    const alpha = Math.min(1, mensajeRachaTimer / 30);
    const escala =
      mensajeRachaTimer > 90 ? 1 + ((mensajeRachaTimer - 90) / 30) * 0.3 : 1;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(22 * escala)}px ${FUENTE}`;
    ctx.fillStyle = "#8B4513";
    ctx.shadowColor = "rgba(255, 200, 80, 0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(mensajeRacha, this.canvas.width / 2, 80);
    ctx.restore();
  }

  /**
   * Muestra la interfaz superior (puntuación actual, récord, y racha/velocidad).
   * @param {number} puntuacion - Score actual.
   * @param {boolean} modoDificil - Indica si es modo extremo.
   * @param {number} recordNormal - Máxima puntuación local Normal.
   * @param {number} recordExtremo - Máxima puntuación local Extremo.
   * @param {number} rachaExtremo - Esquives seguidos.
   * @param {number} incrementoExtremo - Velocidad escalada.
   */
  dibujarPuntuacion(
    puntuacion,
    modoDificil,
    recordNormal,
    recordExtremo,
    rachaExtremo,
    incrementoExtremo,
  ) {
    const ctx = this.ctx;
    ctx.fillStyle = COLOR_TINTA;
    ctx.font = `bold 20px ${FUENTE}`;

    ctx.textAlign = "left";
    ctx.fillText(`PUNTOS: ${puntuacion}`, 20, 40);

    const recordAMostrar = modoDificil ? recordExtremo : recordNormal;
    ctx.textAlign = "right";
    ctx.fillText(`MÁXIMA: ${recordAMostrar}`, this.canvas.width - 20, 40);

    if (modoDificil) {
      const velActual = 5 + Math.floor(puntuacion / incrementoExtremo);
      ctx.textAlign = "left";
      ctx.font = `14px ${FUENTE}`;
      ctx.fillStyle = "rgba(62, 39, 35, 0.6)";
      ctx.fillText(`VEL: ${velActual}`, 20, 58);

      if (rachaExtremo > 0) {
        ctx.textAlign = "right";
        ctx.fillText(`RACHA: ${rachaExtremo}`, this.canvas.width - 20, 58);
      }
    }
  }

  /**
   * Dibuja la pantalla inicial (Menú de Selección).
   * @param {string} nombreJugador - Nombre del usuario.
   * @param {boolean} modoDificil - Indica si el modo extremo está preseleccionado.
   * @param {boolean} modoSeleccionado - True si ya pulsó un modo.
   * @param {number} incrementoExtremo - Ajuste de velocidad.
   * @param {AudioManager} audio - Instancia del audio para pintar el botón de mute.
   */
  dibujarMenuPrincipal(
    nombreJugador,
    modoDificil,
    modoSeleccionado,
    incrementoExtremo,
    audio,
  ) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = COLOR_ARENA;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = "center";
    ctx.fillStyle = COLOR_TINTA;
    ctx.font = `bold 36px ${FUENTE}`;
    ctx.fillText("ELIGE TU DESTINO", this.canvas.width / 2, 45);

    ctx.font = `16px ${FUENTE}`;
    ctx.fillStyle = "rgba(62, 39, 35, 0.6)";
    ctx.fillText(
      `✦ ${nombreJugador.toUpperCase()} ✦`,
      this.canvas.width / 2,
      70,
    );

    // Botón NORMAL
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOR_TINTA;
    ctx.fillStyle = !modoDificil ? COLOR_TINTA : "rgba(62, 39, 35, 0.1)";
    ctx.strokeRect(200, 90, 400, 55);
    ctx.fillRect(200, 90, 400, 55);
    ctx.fillStyle = !modoDificil ? COLOR_ARENA : COLOR_TINTA;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText("MODO NORMAL", this.canvas.width / 2, 126);

    // Botón EXTREMO
    ctx.fillStyle = modoDificil ? COLOR_TINTA : "rgba(62, 39, 35, 0.1)";
    ctx.strokeRect(200, 160, 400, 55);
    ctx.fillRect(200, 160, 400, 55);
    ctx.fillStyle = modoDificil ? COLOR_ARENA : COLOR_TINTA;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText("MODO EXTREMO", this.canvas.width / 2, 196);

    ctx.fillStyle = COLOR_TINTA;
    ctx.font = `16px ${FUENTE}`;
    ctx.fillText(
      modoSeleccionado
        ? "── PULSA ENTER, ESPACIO O CLIC PARA JUGAR ──"
        : "Haz clic en un modo para seleccionarlo",
      this.canvas.width / 2,
      235,
    );

    if (modoDificil) this.dibujarSliderExtremo(incrementoExtremo);
    audio.dibujarBoton();
  }

  /**
   * Pinta la barra interactiva (slider) para ajustar la aceleración en Modo Extremo.
   * @param {number} incrementoExtremo - Valor de configuración actual.
   */
  dibujarSliderExtremo(incrementoExtremo) {
    const { x, y, ancho, alto, btnR } = this.SLIDER;
    const tx = this.SLIDER.thumbX(incrementoExtremo);
    const ctx = this.ctx;

    ctx.textAlign = "center";
    ctx.fillStyle = COLOR_TINTA;
    ctx.font = `bold 13px ${FUENTE}`;
    ctx.fillText(
      "VELOCIDAD DE ACELERACIÓN — MODO EXTREMO",
      this.canvas.width / 2,
      y - 18,
    );

    ctx.font = `11px ${FUENTE}`;
    ctx.textAlign = "left";
    ctx.fillText("MÁS RÁPIDO", x, y - 5);
    ctx.textAlign = "right";
    ctx.fillText("MÁS LENTO", x + ancho, y - 5);

    // Track
    ctx.fillStyle = COLOR_TINTA;
    ctx.fillRect(x, y, tx - x, alto);
    ctx.fillStyle = "rgba(62,39,35,0.2)";
    ctx.fillRect(tx, y, x + ancho - tx, alto);

    // Thumb (cursor)
    ctx.beginPath();
    ctx.arc(tx, y + alto / 2, btnR, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_TINTA;
    ctx.fill();
    ctx.strokeStyle = COLOR_ARENA;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Valor numérico
    ctx.fillStyle = COLOR_TINTA;
    ctx.font = `bold 14px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.fillText(incrementoExtremo, tx, y + alto + 20);
  }

  /**
   * Renderiza el cuadro de puntuaciones (Leaderboard Global) que devuelve el servidor.
   * @param {number} puntuacion - Score final obtenido.
   * @param {boolean} modoDificil - Dificultad jugada.
   * @param {number} recordNormal - Récord local.
   * @param {number} recordExtremo - Récord local.
   * @param {Array} listaTopScores - Datos de la API.
   * @param {boolean} puedeReiniciar - Controla el botón de reinicio.
   */
  dibujarRanking(
    puntuacion,
    modoDificil,
    recordNormal,
    recordExtremo,
    listaTopScores,
    puedeReiniciar,
  ) {
    const ctx = this.ctx;
    const margin = this.canvas.width * 0.05;
    const tablaAncho = this.canvas.width * 0.9;
    const tablaX = margin;

    ctx.fillStyle = "rgba(250, 215, 160, 0.98)";
    ctx.fillRect(tablaX, 10, tablaAncho, 380);
    ctx.strokeStyle = COLOR_TINTA;
    ctx.lineWidth = 4;
    ctx.strokeRect(tablaX, 10, tablaAncho, 380);

    ctx.fillStyle = COLOR_TINTA;
    ctx.textAlign = "center";

    ctx.font = `bold 16px ${FUENTE}`;
    ctx.fillText("PUNTUACIÓN FINAL", this.canvas.width / 2, 35);
    ctx.font = `bold 32px ${FUENTE}`;
    ctx.fillText(puntuacion, this.canvas.width / 2, 70);

    const recordActual = modoDificil ? recordExtremo : recordNormal;
    const tieneRecord = puntuacion >= recordActual && puntuacion > 0;
    if (tieneRecord) {
      ctx.font = `bold 14px ${FUENTE}`;
      ctx.fillStyle = "#8B4513";
      ctx.fillText("⭐ ¡NUEVO RÉCORD! ⭐", this.canvas.width / 2, 92);
      ctx.fillStyle = COLOR_TINTA;
    }

    const colIzquierda = tablaX + 40;
    const colDerecha = tablaX + tablaAncho - 40;
    const yTablaStart = tieneRecord ? 125 : 110;

    ctx.font = `bold 15px ${FUENTE}`;
    ctx.textAlign = "left";
    ctx.fillText("FORASTERO", colIzquierda, yTablaStart);
    ctx.textAlign = "right";
    ctx.fillText("PUNTOS", colDerecha, yTablaStart);

    ctx.beginPath();
    ctx.moveTo(colIzquierda, yTablaStart + 6);
    ctx.lineTo(colDerecha, yTablaStart + 6);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 15px ${FUENTE}`;
    listaTopScores.slice(0, 5).forEach((score, index) => {
      const yPos = yTablaStart + 35 + index * 28;
      const nombreCorto =
        score.nombre.length > 15
          ? score.nombre.substring(0, 12) + ".."
          : score.nombre;

      ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.textAlign = "left";
      ctx.fillText(
        `${index + 1}. ${nombreCorto.toUpperCase()}`,
        colIzquierda,
        yPos,
      );
      ctx.textAlign = "right";
      ctx.fillText(`${score.puntos}`, colDerecha, yPos);

      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });

    const yFinalTabla = yTablaStart + 40 + listaTopScores.slice(0, 5).length * 28;
    ctx.save();
    ctx.textAlign = "center";
    if (puntuacion < (modoDificil ? recordExtremo : recordNormal)) {
      ctx.fillStyle = COLOR_TINTA;
      ctx.font = "bold 16px 'Courier Prime'";
      const frase = FRASES_DERROTA[puntuacion % FRASES_DERROTA.length];
      ctx.fillText(frase, this.canvas.width / 2, yFinalTabla + 25);
    }
    ctx.restore();

    ctx.textAlign = "center";
    ctx.font = `bold 18px ${FUENTE}`;
    ctx.fillText(
      puedeReiniciar ? "CLIC PARA REINTENTAR" : "⌛ REGISTRANDO...",
      this.canvas.width / 2,
      375,
    );
  }

  /**
   * Pantalla transitoria estilo "Fade In" que aparece al morir mientras carga el ranking.
   * @param {number} puntuacion - Score final obtenido.
   * @param {number} framesMuerte - Temporizador para suavizar animaciones (Fade/Parpadeo).
   */
  dibujarPantallaMuerte(puntuacion, framesMuerte) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const alphaFondo = Math.min(1, framesMuerte / 30);
    ctx.save();
    ctx.globalAlpha = alphaFondo * 0.55;
    ctx.fillStyle = "#3E1010";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const alphaTexto = Math.min(1, (framesMuerte - 10) / 25);
    if (alphaTexto <= 0) return;

    ctx.save();
    ctx.globalAlpha = alphaTexto;

    ctx.fillStyle = "rgba(250, 215, 160, 0.96)";
    ctx.fillRect(150, 120, w - 300, 165);
    ctx.strokeStyle = COLOR_TINTA;
    ctx.lineWidth = 4;
    ctx.strokeRect(150, 120, w - 300, 165);

    ctx.fillStyle = COLOR_TINTA;
    ctx.textAlign = "center";

    const parpadeo = Math.floor(framesMuerte / 12) % 2 === 0 ? "💀" : "✝";
    ctx.font = `bold 28px ${FUENTE}`;
    ctx.fillText(parpadeo, w / 2, 162);

    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText("HAS CAÍDO, FORASTERO", w / 2, 198);

    ctx.font = `18px ${FUENTE}`;
    ctx.fillStyle = "rgba(62,39,35,0.7)";
    ctx.fillText(`PUNTUACIÓN: ${puntuacion}`, w / 2, 228);

    const puntos = ".".repeat(Math.floor(framesMuerte / 15) % 4);
    ctx.font = `14px ${FUENTE}`;
    ctx.fillStyle = "rgba(62,39,35,0.5)";
    ctx.fillText(`CONSULTANDO EL REGISTRO${puntos}`, w / 2, 266);

    ctx.restore();
  }

  /**
   * Cartel sencillo de carga al conectar con base de datos.
   */
  dibujarCargando() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = COLOR_ARENA;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = COLOR_TINTA;
    this.ctx.font = `bold 24px ${FUENTE}`;
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "CARGANDO RÉCORD...",
      this.canvas.width / 2,
      this.canvas.height / 2,
    );
  }
}

// =============================================================================
// CLASE: GestorObstaculos
// =============================================================================
/**
 * Clase que gestiona el Spawning (generación), movimiento y lógicas de colisión de las balas.
 * Distingue lógicas para los patrones rítmicos (Modo Normal) y el 1 vs 1 (Modo Extremo).
 */
class GestorObstaculos {
  /**
   * Inicializa las colecciones y temporizadores del gestor.
   */
  constructor() {
    this.obstaculos = [];
    this.colaPatron = [];
    this.distanciaUltima = 0;
    this.telegrafiarTimer = 0;
    this.TELEGRAFIAR_FRAMES = 80;
    this.saltoDisponibleExtremo = false;
  }

  /**
   * Limpia toda la lógica de los obstáculos al reiniciar.
   */
  reset() {
    this.obstaculos = [];
    this.colaPatron = [];
    this.distanciaUltima = 0;
    this.telegrafiarTimer = 0;
    this.saltoDisponibleExtremo = false;
  }

  /**
   * Punto de entrada principal. Genera balas según la modalidad seleccionada.
   * @param {number} puntuacion - Define el incremento de dificultad global.
   * @param {boolean} modoDificil - Selección de Normal o Extremo.
   * @param {number} incrementoExtremo - Dificultad base para escalar velocidades.
   * @param {Personaje} personaje - Instancia del vaquero (para saber si está en el suelo).
   */
  actualizar(puntuacion, modoDificil, incrementoExtremo, personaje) {
    const incremento = modoDificil ? incrementoExtremo : 500;
    const vActual = 5 + Math.floor(puntuacion / incremento);

    if (!modoDificil) {
      this._actualizarNormal(vActual);
    } else {
      this._actualizarExtremo(vActual, personaje);
    }
  }

  /**
   * Lógica interna: Modo normal usa el diccionario `PATRONES_NORMAL` como oleadas de balas.
   * @param {number} vActual - Velocidad con la que se empuja la bala.
   * @private
   */
  _actualizarNormal(vActual) {
    this.distanciaUltima += vActual;

    if (this.colaPatron.length === 0) {
      if (this.distanciaUltima > 1200) {
        const indice = Math.floor(Math.random() * PATRONES_NORMAL.length);
        this.colaPatron = JSON.parse(JSON.stringify(PATRONES_NORMAL[indice]));
        this.distanciaUltima = 0;
      }
      return;
    }

    if (this.distanciaUltima >= this.colaPatron[0].gap) {
      const infoBala = this.colaPatron.shift();
      this.obstaculos.push({
        x: canvas.width,
        y: infoBala.y,
        ancho: 30,
        alto: 10,
        velocidad: vActual,
        pasada: false,
      });
      this.distanciaUltima = 0;
    }
  }

  /**
   * Lógica interna: Modo extremo genera una bala al azar previo "telegrafiado".
   * @param {number} vActual - Velocidad del proyectil.
   * @param {Personaje} personaje - El jugador.
   * @private
   */
  _actualizarExtremo(vActual, personaje) {
    if (
      this.obstaculos.length === 0 &&
      this.telegrafiarTimer === 0 &&
      personaje.enSuelo
    ) {
      if (Math.random() < 0.05) {
        this.telegrafiarTimer = this.TELEGRAFIAR_FRAMES;
        this.saltoDisponibleExtremo = true; // Activa permiso visual
      }
    }
    if (this.telegrafiarTimer > 0) {
      this.telegrafiarTimer--;
      if (this.telegrafiarTimer === 0 && this.obstaculos.length === 0) {
        this.obstaculos.push({
          x: canvas.width,
          y: ALTURA_BAJA,
          ancho: 30,
          alto: 10,
          velocidad: vActual,
          pasada: false,
        });
      }
    }
  }

  /**
   * Recorre el array de obstáculos, actualiza su posición horizontal
   * y efectúa la evaluación de colisiones AABB con márgenes.
   * @param {Personaje} personaje - Hitbox del Vaquero.
   * @param {SistemaParticulas} particulas - Gestor de FX.
   * @param {Function} onColision - Callback a invocar en caso de impacto.
   * @param {Function} onEsquive - Callback a invocar en caso de esquive perfecto.
   */
  moverYColisionar(personaje, particulas, onColision, onEsquive) {
    const MARGEN_X = 20; // Permisividad horizontal
    const MARGEN_Y = 2;  // Permisividad vertical para "balas altas"

    for (let i = this.obstaculos.length - 1; i >= 0; i--) {
      const obs = this.obstaculos[i];
      const xAnterior = obs.x;
      obs.x -= obs.velocidad;

      // Colisión (Considera tunnel-effect en frames altos evaluando X anterior)
      const colision =
        personaje.x + MARGEN_X < xAnterior + obs.ancho &&
        personaje.x + personaje.ancho - MARGEN_X > obs.x &&
        personaje.y + MARGEN_Y < obs.y + obs.alto &&
        personaje.y + personaje.alto - MARGEN_Y > obs.y;

      if (colision) {
        onColision();
        return; 
      }

      // Proyectil sale de pantalla (Esquive logrado)
      if (obs.x < -obs.ancho) {
        particulas.emitirEsquive(obs.x, obs.y, obs.alto);
        onEsquive();
        this.obstaculos.splice(i, 1);
      }
    }
  }
}

// =============================================================================
// CLASE: GestorRacha
// =============================================================================
/**
 * Registra esquives consecutivos (Racha/Combo) y libera textos en pantalla.
 */
class GestorRacha {
  /**
   * Inicializa variables numéricas de texto y contadores.
   */
  constructor() {
    this.racha = 0;
    this.mensaje = "";
    this.timer = 0;
  }

  /** Restaura racha tras morir. */
  reset() {
    this.racha = 0;
    this.mensaje = "";
    this.timer = 0;
  }

  /**
   * Suma +1 al esquivar y evalúa hitos especiales decombo.
   */
  registrarEsquive() {
    this.racha++;
    const hitos = [5, 10, 20, 30, 50];
    if (hitos.includes(this.racha)) {
      const textos = {
        5: "¡5 ESQUIVADAS!",
        10: "¡10 ESQUIVADAS! ¡LEYENDA!",
        20: "¡20! ¡IMPARABLE!",
        30: "¡30! ¿ERES HUMANO?",
        50: "¡50! ¡EL DIABLO NO PUEDE CONTIGO!",
      };
      this.mensaje = textos[this.racha];
      this.timer = 120; // Tiempo de visualización
    }
  }

  /** Resta un frame al HUD de combos. */
  tickTimer() {
    if (this.timer > 0) this.timer--;
  }
}

// =============================================================================
// CLASE: InputManager
// =============================================================================
/**
 * Capa de abstracción que mapea teclas, mouse, y toques táctiles a comandos.
 */
class InputManager {
  /**
   * Vincula oyentes globales en la creación.
   * @param {HTMLCanvasElement} canvas - Target gráfico interactivo.
   * @param {Juego} juego - Inyección del motor para delegar métodos de menú o saltos.
   */
  constructor(canvas, juego) {
    this.canvas = canvas;
    this.juego = juego;
    this.teclaPulsada = false;
    this.arrastrando = false;
    this._registrar();
  }

  /**
   * Registra los Event Listeners nativos.
   * @private
   */
  _registrar() {
    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this.teclaPulsada = false;
    });
    window.addEventListener("pointerup", () => {
      this.teclaPulsada = false;
    });

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault(), false);
    
    const block = (e) => { if (e.target === this.canvas) e.preventDefault(); };
    this.canvas.addEventListener("touchstart", block, { passive: false });
    this.canvas.addEventListener("touchend", block, { passive: false });
    this.canvas.addEventListener("touchmove", block, { passive: false });

    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.canvas.addEventListener("pointerup", () => { this.arrastrando = false; });
  }

  /**
   * @private
   * @param {KeyboardEvent} e - Objeto de evento Teclado.
   */
  _onKeyDown(e) {
    if (e.code === "Space") e.preventDefault();

    const j = this.juego;

    // Menú principal (Selección de modo con teclas 1/2 o Espacio/Enter)
    if (!j.juegoIniciado) {
      if (e.key === "1") {
        j.modoDificil = false;
        j.modoSeleccionado = true;
        j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        return;
      }
      if (e.key === "2") {
        j.modoDificil = true;
        j.modoSeleccionado = true;
        j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (j.modoSeleccionado) j.iniciarPartida();
      }
      return;
    }

    // Reinicio
    if (j.juegoTerminado) {
      if ((e.code === "Space" || e.code === "KeyR") && j.puedeReiniciar) j.reiniciar();
      return;
    }

    // Saltar en juego
    if (e.code === "Space") {
      if (this.teclaPulsada) return;
      this.teclaPulsada = true;
      j.saltar();
    }
  }

  /**
   * @private
   * @param {PointerEvent} e - Objeto de evento de Clic/Touch.
   */
  _onPointerDown(e) {
    const { clickX, clickY } = this._escalar(e);
    const j = this.juego;

    const esClicEnMute = clickX > this.canvas.width - 60 && clickY < 50;
    j.audio.intentarReproducir();

    // Toggle de música
    if (esClicEnMute) {
      j.audio.toggle();
      if (!j.juegoIniciado)
        j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
      return;
    }

    // Lógica en menús iniciales
    if (!j.juegoIniciado) {
      // Detección de slider
      if (j.modoDificil && j.modoSeleccionado) {
        const sl = j.renderer.SLIDER;
        const enTrack =
          clickX >= sl.x - sl.btnR && clickX <= sl.x + sl.ancho + sl.btnR &&
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

      // Detección de botones de modo
      const enNormal = clickX >= 200 && clickX <= 600 && clickY >= 90 && clickY <= 145;
      const enExtremo = clickX >= 200 && clickX <= 600 && clickY >= 160 && clickY <= 215;

      if (enNormal) {
        if (j.modoSeleccionado && !j.modoDificil) j.iniciarPartida();
        else {
          j.modoDificil = false;
          j.modoSeleccionado = true;
          j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        }
        return;
      } else if (enExtremo) {
        if (j.modoSeleccionado && j.modoDificil) j.iniciarPartida();
        else {
          j.modoDificil = true;
          j.modoSeleccionado = true;
          j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
        }
        return;
      }
    }

    // Reintento
    if (j.juegoTerminado) {
      if (j.puedeReiniciar) j.reiniciar();
      return;
    }

    j.saltar();
  }

  /**
   * Arrastre para slider (solo menú).
   * @private
   * @param {PointerEvent} e
   */
  _onPointerMove(e) {
    if (!this.arrastrando) return;
    const { clickX } = this._escalar(e);
    const j = this.juego;
    const sl = j.renderer.SLIDER;
    const ratio = Math.max(0, Math.min(1, (clickX - sl.x) / sl.ancho));
    j.incrementoExtremo = Math.round(sl.min + ratio * (sl.max - sl.min));
    j.renderer.dibujarMenuPrincipal(j.nombreJugador, j.modoDificil, j.modoSeleccionado, j.incrementoExtremo, j.audio);
  }

  /**
   * Transforma las coordenadas DOM/Window a la escala interna de dibujo del Canvas.
   * @private
   * @param {PointerEvent} e 
   * @returns {{clickX: number, clickY: number}}
   */
  _escalar(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      clickX: (e.clientX - rect.left) * scaleX,
      clickY: (e.clientY - rect.top) * scaleY,
    };
  }
}

// =============================================================================
// CLASE PRINCIPAL: Juego
// =============================================================================
/**
 * Clase Root: Orquesta e instancía todos los subsistemas (Renderizado, Físicas, Entradas, API).
 * Gestiona el ciclo vital (Main Loop) a 60FPS.
 */
class Juego {
  /**
   * Instancía los servicios y variables iniciales. Ejecuta su primer render y bucle.
   */
  constructor() {
    // ── Servicios ──────────────────────────────────────────────────────────
    this.api = new ApiService(API_BASE);
    this.audio = new AudioManager("resources/cancion2.mp3");
    this.renderer = new Renderer(ctx, canvas);
    this.particulas = new SistemaParticulas();
    this.personaje = new Personaje();
    this.obstaculos = new GestorObstaculos();
    this.racha = new GestorRacha();
    this.input = new InputManager(canvas, this);

    // ── Estado ─────────────────────────────────────────────────────────────
    this.juegoIniciado = false;
    this.juegoTerminado = false;
    this.modoDificil = false;
    this.modoSeleccionado = false;
    this.puedeReiniciar = false;
    this.puntuacion = 0;
    this.incrementoExtremo = 25;
    this.feedbackSaltoBloqueado = 0;
    this.framesMuerte = 0; 
    this.listaTopScores = [];

    // ── Récords Locales ────────────────────────────────────────────────────
    this.recordNormal = parseInt(localStorage.getItem("record_Normal"), 10) || 0;
    this.recordExtremo = parseInt(localStorage.getItem("record_Extremo"), 10) || 0;

    // ── Perfil de Jugador ──────────────────────────────────────────────────
    this.nombreJugador = this._obtenerNombre();

    // ── Arranque ───────────────────────────────────────────────────────────
    this._loop();
  }

  /**
   * Obtiene (vía Prompt) o recupera (vía LocalStorage) el identificador del usuario.
   * @private
   * @returns {string} Nombre alfanumérico.
   */
  _obtenerNombre() {
    const guardado = localStorage.getItem("vaqueroNombre");
    if (guardado) return guardado;
    const input = prompt("Introduce tu nombre de vaquero:");
    const nombre = input && input.trim() !== "" ? input.trim() : "Forastero#" + Math.floor(Math.random() * 9000 + 1000);
    localStorage.setItem("vaqueroNombre", nombre);
    return nombre;
  }

  /**
   * Invoca los métodos de Network/API de muerte asíncrona para guardar datos
   * y cargar los Leaderboards más recientes.
   * @private
   */
  async _registrarMuerte() {
    const dificultad = this.modoDificil ? "Extremo" : "Normal";
    await this.api.enviarPuntuacion(this.nombreJugador, this.puntuacion, dificultad);
    this.listaTopScores = await this.api.obtenerTopScores(dificultad);
    this.puedeReiniciar = true;
  }

  /**
   * Realiza un fetch de inicio para validar el récord real en servidor y no ser corrompible.
   * @private
   */
  async _sincronizarRecord() {
    const dificultad = this.modoDificil ? "Extremo" : "Normal";
    const record = await this.api.obtenerMiRecord(this.nombreJugador, dificultad);
    if (this.modoDificil) {
      this.recordExtremo = record;
      localStorage.setItem("record_Extremo", record);
    } else {
      this.recordNormal = record;
      localStorage.setItem("record_Normal", record);
    }
  }

  /**
   * Aplica un vector de fuerza vertical negativo para impulsar al personaje hacia arriba.
   * Valida lógicas especiales de bloqueo si estamos en modo difícil (Timing Penalty).
   */
  saltar() {
    if (!this.personaje.enSuelo) return;

    if (this.modoDificil) {
      if (!this.obstaculos.saltoDisponibleExtremo) {
        this.feedbackSaltoBloqueado = 10;
        return;
      }
      this.obstaculos.saltoDisponibleExtremo = false; // "Gasta" la bala visual
    }

    this.personaje.dy = -this.personaje.saltoFuerza;
    this.personaje.enSuelo = false;
    this.input.teclaPulsada = true;
    this.particulas.emitirSalto(this.personaje.x, this.personaje.y, this.personaje.ancho, this.personaje.alto);
  }

  /**
   * Metodo enlazador: Muestra pantalla de carga e invoca métodos de red antes del Game Loop.
   */
  async iniciarPartida() {
    this.renderer.dibujarCargando();
    await this._sincronizarRecord();
    this.api.obtenerTopScores(this.modoDificil ? "Extremo" : "Normal"); // precarga
    this.juegoIniciado = true;
    this._loop();
  }

  /**
   * Restablece clases y contadores a valores '0' de inicio de bucle jugable.
   */
  reiniciar() {
    this.juegoIniciado = false;
    this.juegoTerminado = false;
    this.puntuacion = 0;
    this.puedeReiniciar = false;
    this.feedbackSaltoBloqueado = 0;
    this.framesMuerte = 0;
    this.listaTopScores = [];
    this.modoSeleccionado = this.modoDificil; 

    this.particulas.reset();
    this.personaje.reset();
    this.obstaculos.reset();
    this.racha.reset();

    this.renderer.dibujarMenuPrincipal(this.nombreJugador, this.modoDificil, this.modoSeleccionado, this.incrementoExtremo, this.audio);
  }

  /**
   * Comprueba en cada iteración de update si la puntuación superó los Récords del cliente.
   * @private
   */
  _actualizarRecord() {
    const recordActual = this.modoDificil ? this.recordExtremo : this.recordNormal;
    if (this.puntuacion > recordActual) {
      if (this.modoDificil) this.recordExtremo = this.puntuacion;
      else this.recordNormal = this.puntuacion;
    }
  }

  /**
   * Motor Cíclico Principal:
   * Evalúa lógica (Update), limpia Canvas y delega pintado de objetos (Render).
   * @private
   */
  _loop() {
    if (!this.juegoIniciado) {
      this.renderer.dibujarMenuPrincipal(this.nombreJugador, this.modoDificil, this.modoSeleccionado, this.incrementoExtremo, this.audio);
      return;
    }

    if (this.juegoTerminado) {
      this.framesMuerte++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!this.puedeReiniciar) {
        this.renderer.pintarFondo(this.puntuacion, this.modoDificil);
        this.personaje.dibujar(this.puntuacion, 0);
        this.renderer.dibujarBalas(this.obstaculos.obstaculos);
        this.renderer.dibujarPantallaMuerte(this.puntuacion, this.framesMuerte);
      } else {
        this.renderer.dibujarRanking(this.puntuacion, this.modoDificil, this.recordNormal, this.recordExtremo, this.listaTopScores, this.puedeReiniciar);
      }

      requestAnimationFrame(() => this._loop());
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. UPDATE STATES
    this.renderer.pintarFondo(this.puntuacion, this.modoDificil);
    this.personaje.aplicarFisicas(this.input.teclaPulsada);

    if (this.feedbackSaltoBloqueado > 0) this.feedbackSaltoBloqueado--;

    this.obstaculos.actualizar(this.puntuacion, this.modoDificil, this.incrementoExtremo, this.personaje);

    this.obstaculos.moverYColisionar(
      this.personaje,
      this.particulas,
      () => { // Callback: onColision
        if (!this.juegoTerminado) {
          this.juegoTerminado = true;
          this.racha.reset();
          if (navigator.vibrate) navigator.vibrate(100);
          this._registrarMuerte();
        }
      },
      () => { // Callback: onEsquive
        if (this.modoDificil) this.racha.registrarEsquive();
      },
    );

    // 2. RENDER COMPONENTS
    this.personaje.dibujar(this.puntuacion, this.feedbackSaltoBloqueado);
    this.renderer.dibujarBalas(this.obstaculos.obstaculos);
    this.particulas.actualizarYDibujar();
    this.renderer.dibujarTelegrafiarBala(this.modoDificil, this.obstaculos.telegrafiarTimer, this.obstaculos.TELEGRAFIAR_FRAMES);

    this.racha.tickTimer();
    this.renderer.dibujarMensajeRacha(this.racha.mensaje, this.racha.timer);

    this._actualizarRecord();
    this.renderer.dibujarPuntuacion(this.puntuacion, this.modoDificil, this.recordNormal, this.recordExtremo, this.racha.racha, this.incrementoExtremo);

    this.puntuacion++;
    requestAnimationFrame(() => this._loop());
  }
}

// =============================================================================
// TABLÓN LATERAL DE FORASTEROS (Paginación)
// =============================================================================
const panelForasteros = {
    datos: [],
    paginaActual: 1,
    itemsPorPagina: 4, // Cuántos mini-carteles se ven a la vez

    iniciar: async function() {
        try {
            const respuesta = await fetch(`${API_BASE}/todos-los-records`);
            if (respuesta.ok) {
                this.datos = await respuesta.json();
                this.renderizarPagina();
                this.configurarBotones();
            }
        } catch (error) {
            console.error("Error al cargar forasteros:", error);
        }
    },

    renderizarPagina: function() {
        const contenedor = document.getElementById("lista-mini-carteles");
        const textoPag = document.getElementById("texto-paginacion");
        contenedor.innerHTML = ""; // Limpiar panel

        if (this.datos.length === 0) return;

        const totalPaginas = Math.ceil(this.datos.length / this.itemsPorPagina);
        
        // Calcular qué porción del array mostrar
        const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
        const fin = inicio + this.itemsPorPagina;
        const forasterosPagina = this.datos.slice(inicio, fin);

        // Crear los mini-carteles
        forasterosPagina.forEach(forastero => {
            const div = document.createElement("div");
            div.className = "mini-cartel";
            div.innerHTML = `
                <h4>${forastero.nombre}</h4>
                <p class="mini-puntos">${forastero.record}</p>
                <p class="mini-sello">PUNTOS DE RECOMPENSA</p>
            `;
            contenedor.appendChild(div);
        });

        // Actualizar UI de paginación
        textoPag.innerText = `${this.paginaActual} / ${totalPaginas}`;
        document.getElementById("btn-prev-page").disabled = this.paginaActual === 1;
        document.getElementById("btn-next-page").disabled = this.paginaActual === totalPaginas;
    },

    configurarBotones: function() {
        document.getElementById("btn-prev-page").addEventListener("click", () => {
            if (this.paginaActual > 1) {
                this.paginaActual--;
                this.renderizarPagina();
            }
        });

        document.getElementById("btn-next-page").addEventListener("click", () => {
            const totalPaginas = Math.ceil(this.datos.length / this.itemsPorPagina);
            if (this.paginaActual < totalPaginas) {
                this.paginaActual++;
                this.renderizarPagina();
            }
        });
    }
};

// Arrancar el panel cuando la ventana termine de cargar
window.addEventListener('load', () => {
    panelForasteros.iniciar();
});
// =============================================================================
// ARRANQUE
// =============================================================================
const juego = new Juego();