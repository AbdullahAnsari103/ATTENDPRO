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
    }
});

module.exports = mongoose.model('Student', data);

