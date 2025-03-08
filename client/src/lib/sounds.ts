const successSound = new Audio('/success.mp3');

export function playSuccessSound() {
  successSound.play().catch(err => {
    console.error('Failed to play sound:', err);
  });
}
