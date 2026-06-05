import confetti from 'canvas-confetti';

/** A burst of gold/green confetti for wins. */
export function celebrate(intensity: 'small' | 'big' = 'small') {
  const colors = ['#f5b942', '#1fd655', '#f7d27a', '#7be3ff'];
  const count = intensity === 'big' ? 180 : 80;

  confetti({
    particleCount: count,
    spread: intensity === 'big' ? 110 : 70,
    startVelocity: intensity === 'big' ? 55 : 40,
    origin: { y: 0.6 },
    colors,
    scalar: 1.1,
    ticks: 220,
  });

  if (intensity === 'big') {
    // side cannons
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors });
      confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors });
    }, 180);
  }
}
