const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    USERNAME: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    EMAIL: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    PASSWORD: {
        type: String,
        required: true,
        minlength: 6
    },
    FULLNAME: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    ROLE: {
        type: String,
        enum: ['teacher', 'admin', 'student'],
        default: 'teacher'
    },
    ISACTIVE: {
        type: Boolean,
        default: true
    },
    CREATEDAT: {
        type: Date,
        default: Date.now
    },
    LASTLOGIN: {
        type: Date,
        default: Date.now
    },
    PROFILEPIC: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('PASSWORD')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.PASSWORD = await bcrypt.hash(this.PASSWORD, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.PASSWORD);
};

// Method to get user info without password
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.PASSWORD;
    return user;
};

module.exports = mongoose.model('User', userSchema); 