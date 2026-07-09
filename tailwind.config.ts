import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-hebrew)", "system-ui", "sans-serif"],
      },
      colors: {
        // ניטרלי ומכובד — בלי לתעדף עדשה אחת על אחרת
        ink: "#1c1917",
        paper: "#faf9f7",
        muted: "#78716c",
        line: "#e7e5e4",
        accent: "#4f46e5",
      },
    },
  },
  plugins: [],
};

export default config;
