export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#141414',
        clay: '#b95738',
        mint: '#89c9b8',
        volt: '#d7f45b'
      },
      boxShadow: {
        lift: '0 18px 60px rgba(20, 20, 20, 0.14)'
      }
    }
  },
  plugins: []
};
