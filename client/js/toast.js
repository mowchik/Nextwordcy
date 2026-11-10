// client/js/toast.js
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(message, type = 'info', duration = 3000) {
    if (!this.container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    this.container.appendChild(el);
    setTimeout(() => { el.remove(); }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); },
};
