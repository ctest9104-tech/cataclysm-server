const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so your game can talk to the server
app.use(cors());

// The API Route
app.get('/api/cards', (req, res) => {
    const cards = require('./cards.json');
    res.json(cards);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

