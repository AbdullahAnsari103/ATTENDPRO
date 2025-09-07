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
    },
    // New fields for multi-teacher support
    TEACHERS: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    CLASSCODE: {
        type: String,
        unique: true,
        required: true,
        uppercase: true,
        minlength: 6,
        maxlength: 8
    },
    ISACTIVE: {
        type: Boolean,
        default: true
    },
    DESCRIPTION: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Generate unique class code before validation
classSchema.pre('validate', async function(next) {
    try {
        if (this.isNew && !this.CLASSCODE) {
            // Generate unique class code
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code;
            let isUnique = false;
            
            while (!isUnique) {
                code = '';
                for (let i = 0; i < 6; i++) {
                    code += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                
                // Use this.constructor to access the model
                const existingClass = await this.constructor.findOne({ CLASSCODE: code });
                if (!existingClass) {
                    isUnique = true;
                }
            }
            
            this.CLASSCODE = code;
        }
        
        // Ensure creator is in teachers array
        if (this.isNew) {
            if (!this.TEACHERS || this.TEACHERS.length === 0) {
                this.TEACHERS = [this.CREATEDBY];
            }
        }
        
        next();
    } catch (error) {
        console.error('Error in class pre-save hook:', error);
        next(error);
    }
});

module.exports = mongoose.model('Class', classSchema);