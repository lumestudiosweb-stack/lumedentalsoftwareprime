/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep blue-black surfaces (Dentaverse style — was zinc-greys)
        surface: {
          0: '#070a14',
          1: '#0c111d',
          2: '#121826',
          3: '#1a2233',
          4: '#252e44',
        },
        // Existing lume blue kept for backward compat
        lume: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffd',
          300: '#7cc5fc',
          400: '#36a7f8',
          500: '#0c8ce9',
          600: '#006fc7',
          700: '#0158a1',
          800: '#064b85',
          900: '#0b3f6e',
          950: '#072849',
        },
        // New teal accent palette — primary action color in the redesign
        teal: {
          50: '#effcf9',
          100: '#caf7ef',
          200: '#95ecdd',
          300: '#5ad9c4',
          400: '#2cc1ab',
          500: '#14a892',
          600: '#0e8a7a',
          700: '#0d6e63',
          800: '#0f574f',
          900: '#0e463f',
          950: '#062a28',
        },
      },
    },
  },
  plugins: [],
};
