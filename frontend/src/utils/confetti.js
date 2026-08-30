import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 }
  };

  const palette = ['#4ADE80', '#E8B84A', '#5FA8E8', '#F2F1EC', '#22C55E'];

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: palette
  });
  fire(0.2, {
    spread: 60,
    colors: ['#4ADE80', '#E8B84A']
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: palette
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#4ADE80', '#5FA8E8', '#F2F1EC']
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: palette
  });
};
