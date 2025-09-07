const mongoose = require('mongoose');

const data = new mongoose.Schema({
    NAME:{
        type : String,
        required : true,
    },
    EMAIL:{
        type : String,
        required : false,
    },
    ROLLNO:{
        type : Number,
        required : true,
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    // New field to support multiple classes
    CLASSES: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    PHONE: {
        type: String,
        required: false
    },
    PARENTPHONE: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Compound index to ensure unique roll numbers per class
data.index({ ROLLNO: 1, classId: 1 }, { unique: true });

// Ensure primary class is included in CLASSES array
data.pre('save', function(next) {
    if (this.isNew || this.isModified('classId')) {
        if (!this.CLASSES.includes(this.classId)) {
            this.CLASSES.push(this.classId);
        }
    }
    next();
});

module.exports = mongoose.model('Student', data);

