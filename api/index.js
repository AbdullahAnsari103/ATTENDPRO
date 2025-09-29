// Vercel serverless function entry point for AttendPro
const { app } = require('../index.js');

// Export the Express app as a serverless function handler for Vercel
module.exports = (req, res) => app(req, res);