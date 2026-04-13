const REST_MESSAGES = [
  "Tu cerebro necesita oxígeno. Levántate, estira y respira profundo. 🧘",
  "Los mejores programadores descansan. Toma agua y mueve el cuerpo. 💧",
  "Un descanso de 10 minutos mejora tu concentración un 30%. ¡Aprovéchalo! 🧠",
  "Mira algo lejano por 20 segundos para descansar tus ojos. 👀",
  "Camina un poco. Las mejores ideas llegan cuando te mueves. 🚶",
  "Descansar no es perder tiempo, es invertir en tu próximo sprint. 🚀",
  "Haz 10 sentadillas o estiramientos. Tu cuerpo te lo agradecerá. 💪",
  "Cierra los ojos 2 minutos. Tu mente procesará mejor la información. 😌",
  "Toma un snack saludable. Tu cerebro consume el 20% de tu energía. 🍎",
  "La productividad sostenible requiere pausas. Eres más fuerte cuando descansas. ⚡",
];

export function getRandomRestMessage(): string {
  return REST_MESSAGES[Math.floor(Math.random() * REST_MESSAGES.length)];
}
