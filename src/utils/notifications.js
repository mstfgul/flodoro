export async function requestNotifyPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function notify(title, body) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: '/favicon.ico' });
  setTimeout(() => n.close(), 7000);
}
