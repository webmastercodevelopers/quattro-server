const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/received_data.json');

exports.receiveWebhook = (req, res) => {
    const payload = req.body;

    console.log('--- New Payload Received ---');
    
    const entry = {
        received_at: new Date().toISOString(),
        data: payload
    };

    try {
        let fileData = [];

        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, 'utf8');
            if (rawData) {
                fileData = JSON.parse(rawData);
            }
        }

        fileData.push(entry);
        fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2));
        
        console.log('Saved to data/received_data.json');

        res.status(200).json({ 
            status: "success", 
            message: "Payload received and logged" 
        });

    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ 
            error: "Failed to save data" 
        });
    }
};
