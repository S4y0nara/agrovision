const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plantName: { type: String, required: true },
    disease: { type: String, required: true },
    confidence: { type: Number, required: true },
    treatment: { type: String },
    imageUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Scan', scanSchema);
