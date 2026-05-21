const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'css', 'styles.css');
let content = fs.readFileSync(cssPath, 'utf8');

// The block we want to replace:
const target = `  /* --- UNIVERSAL MOBILE SPACER --- */
  @media screen and (max-width: 767px) {
    .app {
      max-width: 540px !important; /* Slightly wider for better alignment */
      padding-bottom: 80px !important;
    }
    .panel {
      padding: 15px 12px 100px;
    }

/* --- PREMIUM SWEETALERT2 --- */
.swal2-popup {
  background: rgba(18, 18, 20, 0.95) !important;
  backdrop-filter: blur(15px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 25px !important;
  color: #ffffff !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
  font-family: 'Inter', sans-serif !important;
}
.swal2-title {
  color: #d4af37 !important;
  font-weight: 800 !important;
}
.swal2-html-container {
  color: #ffffff !important;
  opacity: 0.8;
  font-size: 14px !important;
}
.swal2-confirm {
  background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%) !important;
  color: #000 !important;
  font-weight: 800 !important;
  border-radius: 12px !important;
  padding: 12px 25px !important;
  box-shadow: 0 5px 15px rgba(212, 175, 55, 0.3) !important;
  border: none !important;
}
.swal2-cancel {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  border-radius: 12px !important;
  padding: 12px 25px !important;
}
.swal2-icon.swal2-info { border-color: #d4af37 !important; color: #d4af37 !important; }
.swal2-icon.swal2-success { border-color: #10b981 !important; color: #10b981 !important; }
.swal2-icon.swal2-error { border-color: #ef4444 !important; color: #ef4444 !important; }
.swal2-timer-progress-bar { background: #d4af37 !important; }
  }`;

// Check if content contains normalized version (ignoring \r)
const targetNormalized = target.replace(/\r\n/g, '\n');
const contentNormalized = content.replace(/\r\n/g, '\n');

if (contentNormalized.includes(targetNormalized)) {
  console.log("Found the target block!");
  const replacement = `  /* --- UNIVERSAL MOBILE SPACER --- */
  @media screen and (max-width: 767px) {
    .app {
      max-width: 540px !important; /* Slightly wider for better alignment */
      padding-bottom: 80px !important;
    }
    .panel {
      padding: 15px 12px 100px;
    }
  }

/* --- PREMIUM SWEETALERT2 --- */
.swal2-popup {
  background: rgba(18, 18, 20, 0.95) !important;
  backdrop-filter: blur(15px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 25px !important;
  color: #ffffff !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
  font-family: 'Inter', sans-serif !important;
}
.swal2-title {
  color: #d4af37 !important;
  font-weight: 800 !important;
}
.swal2-html-container {
  color: #ffffff !important;
  opacity: 0.8;
  font-size: 14px !important;
}
.swal2-confirm {
  background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%) !important;
  color: #000 !important;
  font-weight: 800 !important;
  border-radius: 12px !important;
  padding: 12px 25px !important;
  box-shadow: 0 5px 15px rgba(212, 175, 55, 0.3) !important;
  border: none !important;
}
.swal2-confirm.swal2-confirm-disabled {
  background: #333 !important;
  color: #888 !important;
  box-shadow: none !important;
  cursor: not-allowed !important;
}
.swal2-cancel {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  border-radius: 12px !important;
  padding: 12px 25px !important;
}
.swal2-icon.swal2-info { border-color: #d4af37 !important; color: #d4af37 !important; }
.swal2-icon.swal2-success { border-color: #10b981 !important; color: #10b981 !important; }
.swal2-icon.swal2-error { border-color: #ef4444 !important; color: #ef4444 !important; }
.swal2-timer-progress-bar { background: #d4af37 !important; }`;

  // We should preserve line endings of the original file.
  // If original has \r\n, use it.
  const hasCRLF = content.includes('\r\n');
  const finalReplacement = hasCRLF ? replacement.replace(/\n/g, '\r\n') : replacement;
  const finalTarget = hasCRLF ? target.replace(/\n/g, '\r\n') : target.replace(/\r\n/g, '\n');

  content = content.replace(finalTarget, finalReplacement);
  fs.writeFileSync(cssPath, content, 'utf8');
  console.log("Success: SweetAlert2 CSS moved outside media query and disabled style added!");
} else {
  console.log("Error: Target block not found. Checking if it's already modified...");
  if (contentNormalized.includes('swal2-confirm.swal2-confirm-disabled')) {
    console.log("Already modified!");
  } else {
    // Let's print out what is actually in styles.css around there to debug.
    const startIdx = contentNormalized.indexOf('/* --- UNIVERSAL MOBILE SPACER --- */');
    if (startIdx !== -1) {
      console.log("Found start. Content starting from there:\n", contentNormalized.substring(startIdx, startIdx + 500));
    } else {
      console.log("Could not find start block at all!");
    }
  }
}
