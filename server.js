const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'received_data.json');

// 1. Middleware to parse incoming JSON data
app.use(express.json());

// 2. The Endpoint
app.post('/api/webhook', (req, res) => {
    const payload = req.body;

    console.log('--- New Payload Received ---');
    
    // We create a wrapper object to add a timestamp
    const entry = {
        received_at: new Date().toISOString(),
        data: payload
    };

    // 3. Logic to append to the JSON file
    try {
        let fileData = [];

        // Check if file exists and is not empty
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, 'utf8');
            // If file is empty, keep fileData as empty array, otherwise parse it
            if (rawData) {
                fileData = JSON.parse(rawData);
            }
        }

        // Add the new entry to the array
        fileData.push(entry);

        // Write it back to the file (formatted with 2 spaces for readability)
        fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2));
        
        console.log('Saved to received_data.json');

    } catch (error) {
        console.error('Error saving file:', error);
        return res.status(500).json({ error: "Failed to save data" });
    }

    // Always respond with 200 OK so the sender knows we got it
    res.status(200).json({ status: "success", message: "Payload received and logged" });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Waiting for data at POST /api/webhook...`);
});
