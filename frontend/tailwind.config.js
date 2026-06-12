/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF7A00",
          hover: "#E66E00",
          light: "#FFF4EB"
        },
        secondary: {
          DEFAULT: "#0F172A",
          800: "#1E293B",
          900: "#0F172A"
        },
        background: {
          DEFAULT: "#F5F6FA",
          surface: "#FFFFFF",
          subtle: "#F8FAFC"
        },
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6"
        }
      },
      fontFamily: {
        heading: ["Outfit", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"]
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem'
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.02)',
        'hover': '0 10px 30px -5px rgba(255, 122, 0, 0.15), 0 4px 10px -3px rgba(0, 0, 0, 0.05)'
      }
    },
  },
  plugins: [],
}
