const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    CLASSNAME: {
        type: String,
        required: true
    },
    ROOMNO: {
        type: Number,
        required: true
    },
    SUBJECT: {
        type: String,
        required: true
    },
    CREATEDBY: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Class', classSchema);