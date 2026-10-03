/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Dark base
        slate: {
          950: "#020617",
          900: "#0f172a",
          850: "#131f35",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
        },
        // Accent palette
        indigo: {
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 2s linear infinite",
        shimmer: "shimmer 1.5s infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(99,102,241,0.3)" },
          "50%": { boxShadow: "0 0 20px 6px rgba(99,102,241,0.6)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-gradient":
          "radial-gradient(at 40% 20%, hsla(228,97%,72%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.05) 0px, transparent 50%)",
      },
      boxShadow: {
        "glow-indigo": "0 0 20px rgba(99,102,241,0.4)",
        "glow-cyan": "0 0 20px rgba(34,211,238,0.3)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
