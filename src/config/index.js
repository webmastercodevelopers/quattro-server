const path = require('path');

module.exports = {
    PORT: process.env.PORT || 3000,
    DATA_FILE: path.join(__dirname, '../../data/received_data.json'),
    NODE_ENV: process.env.NODE_ENV || 'development'
};
