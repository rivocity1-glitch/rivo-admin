export const BrowserNotification = {
  async requestPermission() {
    if (!("Notification" in window)) {
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      return false;
    }

    const permission = await Notification.requestPermission();

    return permission === "granted";
  },

  async show(title: string, options?: NotificationOptions) {
    const allowed = await this.requestPermission();

    if (!allowed) {
      return;
    }

    new Notification(title, {
      ...options,
      badge: "/pwa-192x192.png",
      icon: "/pwa-192x192.png",
    });
  },
};