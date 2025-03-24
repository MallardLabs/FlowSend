// Buat file logger.js
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  // Foreground (text) colors
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m",
  },

  // Background colors
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m",
  },
};

// Fungsi untuk mendapatkan timestamp saat ini
const getTimestamp = () => {
  const now = new Date();
  return `${now.toISOString().replace("T", " ").slice(0, -5)}`;
};

// Fungsi untuk mendapatkan nama file pemanggil
const getCallerFile = () => {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack;
  Error.prepareStackTrace = originalPrepareStackTrace;

  // Stack[0] adalah getCallerFile, stack[1] adalah fungsi logger, stack[2] adalah pemanggil
  if (stack.length >= 3) {
    const callerFile = stack[2].getFileName();
    if (callerFile) {
      // Ambil hanya nama file dari path lengkap
      return callerFile.split("/").pop();
    }
  }
  return "unknown";
};

const logger = {
  info: (message) => {
    const timestamp = getTimestamp();
    const file = getCallerFile();
    console.log(
      `${colors.fg.white}[${timestamp}]${colors.reset} ${colors.fg.cyan}[INFO]${colors.reset} ${colors.fg.yellow}[${file}]${colors.reset} ${message}`
    );
  },
  success: (message) => {
    const timestamp = getTimestamp();
    const file = getCallerFile();
    console.log(
      `${colors.fg.white}[${timestamp}]${colors.reset} ${colors.fg.green}[SUCCESS]${colors.reset} ${colors.fg.yellow}[${file}]${colors.reset} ${message}`
    );
  },
  error: (message) => {
    const timestamp = getTimestamp();
    const file = getCallerFile();
    console.error(
      `${colors.fg.white}[${timestamp}]${colors.reset} ${colors.fg.red}[ERROR]${colors.reset} ${colors.fg.yellow}[${file}]${colors.reset} ${message}`
    );
  },
  warn: (message) => {
    const timestamp = getTimestamp();
    const file = getCallerFile();
    console.warn(
      `${colors.fg.white}[${timestamp}]${colors.reset} ${colors.fg.yellow}[WARN]${colors.reset} ${colors.fg.yellow}[${file}]${colors.reset} ${message}`
    );
  },
  debug: (message) => {
    const timestamp = getTimestamp();
    const file = getCallerFile();
    console.log(
      `${colors.fg.white}[${timestamp}]${colors.reset} ${colors.fg.magenta}[DEBUG]${colors.reset} ${colors.fg.yellow}[${file}]${colors.reset} ${message}`
    );
  },
};

export default logger;
