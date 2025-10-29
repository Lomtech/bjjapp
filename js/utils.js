// ================================================
// UTILITY FUNCTIONS
// Hilfsfunktionen für die gesamte App
// ================================================

// Zeige Benachrichtigung
function showNotification(message, duration = 3000) {
  const notification = document.getElementById("notification");
  if (!notification) {
    console.warn("Notification element nicht gefunden");
    return;
  }

  notification.textContent = message;
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, duration);
}

// Format Datum
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Format Zeit
function formatTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format DateTime
function formatDateTime(dateString) {
  if (!dateString) return "";
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
}

// Relative Zeit (z.B. "vor 2 Stunden")
function getRelativeTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return "gerade eben";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `vor ${minutes} Minute${minutes !== 1 ? "n" : ""}`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `vor ${hours} Stunde${hours !== 1 ? "n" : ""}`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
  } else {
    return formatDate(dateString);
  }
}

// Validiere Email
function isValidEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validiere Passwort (mindestens 6 Zeichen)
function isValidPassword(password) {
  return password && password.length >= 6;
}

// Lade Avatar Initialen
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Escape HTML um XSS zu verhindern
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Truncate Text
function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Debounce Funktion (verzögert Funktionsaufruf)
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Lade Bild als Data URL
function loadImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Keine Datei ausgewählt"));
      return;
    }

    // Validiere Dateityp
    if (!APP_CONFIG.supportedImageTypes.includes(file.type)) {
      reject(new Error("Ungültiger Dateityp"));
      return;
    }

    // Validiere Dateigröße
    if (file.size > APP_CONFIG.maxUploadSize) {
      reject(new Error("Datei zu groß (max 5MB)"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// Komprimiere Bild
async function compressImage(
  file,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Berechne neue Dimensionen
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: file.type }));
          },
          file.type,
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generiere UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Scroll zu Element
function scrollToElement(elementId, offset = 0) {
  const element = document.getElementById(elementId);
  if (element) {
    const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

// Check ob Element im Viewport ist
function isInViewport(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Speichere in LocalStorage
function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("LocalStorage Fehler:", error);
    return false;
  }
}

// Lade aus LocalStorage
function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error("LocalStorage Fehler:", error);
    return defaultValue;
  }
}

// Entferne aus LocalStorage
function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("LocalStorage Fehler:", error);
    return false;
  }
}

// Exportiere global
window.showNotification = showNotification;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatDateTime = formatDateTime;
window.getRelativeTime = getRelativeTime;
window.isValidEmail = isValidEmail;
window.isValidPassword = isValidPassword;
window.getInitials = getInitials;
window.escapeHtml = escapeHtml;
window.truncateText = truncateText;
window.debounce = debounce;
window.loadImageAsDataUrl = loadImageAsDataUrl;
window.compressImage = compressImage;
window.generateUUID = generateUUID;
window.scrollToElement = scrollToElement;
window.isInViewport = isInViewport;
window.saveToLocalStorage = saveToLocalStorage;
window.loadFromLocalStorage = loadFromLocalStorage;
window.removeFromLocalStorage = removeFromLocalStorage;
