// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

// Initialize express app
const app = express();

// Set up paths for static files and views
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware for parsing form and JSON data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Import Mongoose Models
const Class = require('./models/class');
const Student = require('./models/student');
const Attendance = require('./models/attendance');
const User = require('./models/user');
const Timetable = require('./models/timetable');

// Import QR Code library
const QRCode = require('qrcode');

// Import authentication middleware
const { requireAuth, requireAdmin, requireTeacher, requireStudent, requireStudentOrTeacher, preventStudentAccess, hasClassAccess, hasClassManagementAccess, userToViews } = require('./middleware/auth');

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Make user available to all views
app.use(userToViews);

// MongoDB connection
const MONGO_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CLASS';

async function main() {
    try {
        await mongoose.connect(MONGO_URL, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${MONGO_URL.includes('127.0.0.1') ? 'Local' : 'Cloud'}`);
        
        // Fix existing data before creating indexes
        try {
            console.log('🔧 Checking for data that needs migration...');
            
            // Fix classes without CLASSCODE
            const classesWithoutCode = await Class.find({ 
                $or: [
                    { CLASSCODE: { $exists: false } },
                    { CLASSCODE: null },
                    { CLASSCODE: '' }
                ]
            });
            
            if (classesWithoutCode.length > 0) {
                console.log(`🔧 Found ${classesWithoutCode.length} classes without class codes. Fixing...`);
                
                for (const classDoc of classesWithoutCode) {
                    // Generate unique class code
                    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    let code;
                    let isUnique = false;
                    
                    while (!isUnique) {
                        code = '';
                        for (let i = 0; i < 6; i++) {
                            code += characters.charAt(Math.floor(Math.random() * characters.length));
                        }
                        
                        const existingClass = await Class.findOne({ CLASSCODE: code });
                        if (!existingClass) {
                            isUnique = true;
                        }
                    }
                    
                    // Update without triggering validation
                    await Class.updateOne(
                        { _id: classDoc._id },
                        { 
                            $set: { 
                                CLASSCODE: code,
                                TEACHERS: classDoc.TEACHERS && classDoc.TEACHERS.length > 0 ? classDoc.TEACHERS : [classDoc.CREATEDBY],
                                ISACTIVE: classDoc.ISACTIVE !== undefined ? classDoc.ISACTIVE : true
                            }
                        }
                    );
                }
                
                console.log('✅ Fixed classes without class codes');
            }
            
            // Fix students without CLASSES array
            const studentsWithoutClasses = await Student.find({ 
                $or: [
                    { CLASSES: { $exists: false } },
                    { CLASSES: { $size: 0 } }
                ]
            });
            
            if (studentsWithoutClasses.length > 0) {
                console.log(`🔧 Found ${studentsWithoutClasses.length} students without CLASSES array. Fixing...`);
                
                for (const student of studentsWithoutClasses) {
                    await Student.updateOne(
                        { _id: student._id },
                        { $set: { CLASSES: [student.classId] } }
                    );
                }
                
                console.log('✅ Fixed students without CLASSES array');
            }
            
        } catch (migrationError) {
            console.log('⚠️ Migration warning:', migrationError.message);
        }
        
        // Now create indexes
        try {
            await Class.createIndexes();
            await Student.createIndexes();
            await User.createIndexes();
            console.log('📋 Database indexes created successfully');
        } catch (indexError) {
            console.log('⚠️ Index creation warning:', indexError.message);
        }
    } catch (err) {
        console.error('❌ Error connecting to MongoDB:', err);
        process.exit(1);
    }
}

// ====================== AUTHENTICATION ROUTES ====================== //

// Login page
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { message: null, messageType: null });
});

// Handle login
app.post('/login', async (req, res) => {
    try {
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
            return res.render('login', { 
                message: 'Database connection error. Please try again later.', 
                messageType: 'error' 
            });
        }

        const { username, password } = req.body;
        
        // Find user by username or email
        const user = await User.findOne({
            $or: [
                { USERNAME: username },
                { EMAIL: username }
            ]
        });
        
        if (!user || !user.ISACTIVE) {
            return res.render('login', { 
                message: 'Invalid username/email or password', 
                messageType: 'error' 
            });
        }
        
        // Check password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.render('login', { 
                message: 'Invalid username/email or password', 
                messageType: 'error' 
            });
        }
        
        // Update last login
        user.LASTLOGIN = new Date();
        await user.save();
        
        // Set session
        req.session.userId = user._id;
        req.session.userRole = user.ROLE;
        
        console.log(`✅ User logged in: ${user.USERNAME} (${user.ROLE})`);
        
        res.redirect('/dashboard');
    } catch (err) {
        console.error('❌ Login error:', err.message);
        res.render('login', { 
            message: 'An error occurred during login', 
            messageType: 'error' 
        });
    }
});

// Register page
app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('register', { message: null, messageType: null });
});

// Handle registration
app.post('/register', async (req, res) => {
    try {
        const { USERNAME, EMAIL, PASSWORD, CONFIRMPASSWORD, FULLNAME, ROLE } = req.body;
        
        // Validation
        if (PASSWORD !== CONFIRMPASSWORD) {
            return res.render('register', { 
                message: 'Passwords do not match', 
                messageType: 'error' 
            });
        }
        
        if (PASSWORD.length < 6) {
            return res.render('register', { 
                message: 'Password must be at least 6 characters long', 
                messageType: 'error' 
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { USERNAME: USERNAME },
                { EMAIL: EMAIL }
            ]
        });
        
        if (existingUser) {
            return res.render('register', { 
                message: 'Username or email already exists', 
                messageType: 'error' 
            });
        }
        
        // Ensure only teachers can register through normal registration
        if (ROLE !== 'teacher') {
            return res.render('register', { 
                message: 'Only teachers can register through this form. Admin access is restricted.', 
                messageType: 'error' 
            });
        }
        
        // Create new user (only teachers)
        const newUser = new User({
            USERNAME,
            EMAIL,
            PASSWORD,
            FULLNAME,
            ROLE: 'teacher' // Force teacher role
        });
        
        await newUser.save();
        
        res.render('login', { 
            message: 'Registration successful! Please login.', 
            messageType: 'success' 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { 
            message: 'An error occurred during registration', 
            messageType: 'error' 
        });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard (protected route)
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        let dashboardData = { user: req.user };

        if (req.user.ROLE === 'admin') {
            // Admin sees all data
            dashboardData.totalUsers = await User.countDocuments();
            dashboardData.totalClasses = await Class.countDocuments();
            dashboardData.totalStudents = await Student.countDocuments();
            dashboardData.totalAttendance = await Attendance.countDocuments();
        } else if (req.user.ROLE === 'teacher') {
            // Teachers see only their data
            const userClasses = await Class.find({
                $or: [
                    { CREATEDBY: req.user._id },
                    { TEACHERS: req.user._id }
                ]
            }).select('_id');
            const classIds = userClasses.map(c => c._id);

            dashboardData.myClasses = userClasses.length;
            dashboardData.myStudents = await Student.countDocuments({ classId: { $in: classIds } });

            // Today's attendance count
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            dashboardData.todayAttendance = await Attendance.countDocuments({
                classId: { $in: classIds },
                date: { $gte: today, $lt: tomorrow }
            });
        }

        res.render('dashboard', dashboardData);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Server error');
    }
});

// ====================== ROUTES ====================== //

// Home Page (redirect to dashboard if logged in)
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('index.ejs');
});

// Render Create Class Form
app.get('/createclass', requireAuth, requireTeacher, async (req, res) => {
    try {
        res.render('createclass.ejs', { user: req.user });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error loading create class form.');
    }
});

// Handle Create Class Form Submission
app.post('/createclass', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { CLASSNAME, ROOMNO, SUBJECT, DESCRIPTION } = req.body;
        
        console.log('Creating class with data:', { CLASSNAME, ROOMNO, SUBJECT, DESCRIPTION });
        
        const newClass = new Class({ 
            CLASSNAME, 
            ROOMNO, 
            SUBJECT,
            DESCRIPTION: DESCRIPTION || '',
            CREATEDBY: req.user._id,
            ISACTIVE: true
        });
        
        console.log('Class object before save:', newClass);
        
        await newClass.save();
        
        console.log('Class saved successfully:', newClass);
        
        res.redirect('/classlist');
    } catch (err) {
        console.error('Detailed error creating class:', err);
        console.error('Error stack:', err.stack);
        res.status(500).send(`Failed to create class: ${err.message}`);
    }
});

// Fetch Class List with Optional Filters (GET)
app.get('/classlist', requireAuth, preventStudentAccess, async (req, res) => {
    try {
        const { CLASSNAME, ROOMNO, SUBJECT } = req.query;

        const query = {};
        if (CLASSNAME) query.CLASSNAME = CLASSNAME;
        if (ROOMNO) query.ROOMNO = ROOMNO;
        if (SUBJECT) query.SUBJECT = SUBJECT;

        // If user is not admin, only show classes where they are a teacher
        if (req.user.ROLE !== 'admin') {
            query.TEACHERS = req.user._id;
        }

        const classlist = await Class.find(query).populate('TEACHERS', 'NAME EMAIL').populate('CREATEDBY', 'NAME EMAIL');

        // Add student count for each class
        const classesWithStudentCount = await Promise.all(classlist.map(async (classItem) => {
            const studentCount = await Student.countDocuments({ classId: classItem._id });
            return {
                ...classItem.toObject(),
                studentCount: studentCount
            };
        }));

        if (!classesWithStudentCount.length) {
            return res.render('classlist.ejs', { classes: [], message: 'No classes found.', user: req.user });
        }

        res.render('classlist.ejs', { classes: classesWithStudentCount, message: null, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Fetch Class List Based on POST Form Submission
app.post('/classlist', requireAuth, preventStudentAccess, async (req, res) => {
    try {
        const { CLASSNAME, ROOMNO, SUBJECT } = req.body;

        const query = {};
        if (CLASSNAME) query.CLASSNAME = CLASSNAME;
        if (ROOMNO) query.ROOMNO = ROOMNO;
        if (SUBJECT) query.SUBJECT = SUBJECT;

        // If user is not admin, only show classes where they are a teacher
        if (req.user.ROLE !== 'admin') {
            query.TEACHERS = req.user._id;
        }

        const classlist = await Class.find(query).populate('TEACHERS', 'NAME EMAIL').populate('CREATEDBY', 'NAME EMAIL');

        // Add student count for each class
        const classesWithStudentCount = await Promise.all(classlist.map(async (classItem) => {
            const studentCount = await Student.countDocuments({ classId: classItem._id });
            return {
                ...classItem.toObject(),
                studentCount: studentCount
            };
        }));

        res.render('classlist.ejs', { classes: classesWithStudentCount, message: null, user: req.user });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error fetching class list');
    }
});

// Handle Class Deletion
app.post('/deleteclass', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { classId } = req.body;
        
        // Check if user owns this class or is admin
        const classToDelete = await Class.findById(classId);
        if (!classToDelete) {
            return res.status(404).send('Class not found');
        }
        
        if (req.user.ROLE !== 'admin' && classToDelete.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied');
        }
        
        await Class.findByIdAndDelete(classId);
        res.redirect('/classlist');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting class');
    }
});

// ====================== CLASS JOIN ROUTES ====================== //

// Join Class Page (GET)
app.get('/join-class', requireAuth, requireTeacher, (req, res) => {
    res.render('join-class', { 
        message: null, 
        messageType: null, 
        user: req.user 
    });
});

// Join Class with Code (POST)
app.post('/join-class', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { classCode } = req.body;
        
        if (!classCode) {
            return res.render('join-class', {
                message: 'Please enter a class code',
                messageType: 'error',
                user: req.user
            });
        }
        
        // Find class by code
        const classDoc = await Class.findOne({ CLASSCODE: classCode.toUpperCase() });
        
        if (!classDoc) {
            return res.render('join-class', {
                message: 'Invalid class code. Please check and try again.',
                messageType: 'error',
                user: req.user
            });
        }
        
        // Check if user is already a teacher in this class
        if (classDoc.TEACHERS.includes(req.user._id)) {
            return res.render('join-class', {
                message: 'You are already a teacher in this class.',
                messageType: 'warning',
                user: req.user
            });
        }
        
        // Add user to teachers array
        classDoc.TEACHERS.push(req.user._id);
        await classDoc.save();
        
        res.redirect(`/classdetail/${classDoc._id}?joined=true`);
        
    } catch (error) {
        console.error('Join class error:', error);
        res.render('join-class', {
            message: 'An error occurred while joining the class.',
            messageType: 'error',
            user: req.user
        });
    }
});

//class detail
app.get('/classdetail/:id', requireAuth, hasClassAccess, async (req,res)=>{
  try {
        const { id } = req.params;
        const foundClass = req.classDoc; // From hasClassAccess middleware
        const { joined } = req.query;
        
        const students = await Student.find({ classId: id });
        
        // Populate teachers for display
        await foundClass.populate('TEACHERS', 'NAME EMAIL');
        
        res.render('classdetail.ejs', { 
            classDetail: foundClass, 
            students: students, 
            attendances: [],
            joinedMessage: joined === 'true' ? 'Successfully joined the class!' : null,
            absentStudents: [],
            totalLectures: 0,
            totalStudents: students.length,
            selectedDate: null,
            message: null,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Student to Class (AJAX)
app.post('/classdetail/:id/addstudent', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { NAME, ROLLNO } = req.body;
        
        // Check if class exists and user has access
        const foundClass = await Class.findById(id);
        if (!foundClass) {
            return res.json({ success: false, message: 'Class not found.' });
        }
        
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Access denied.' });
        }
        
        // Check if roll number already exists in this class
        const existingStudent = await Student.findOne({ classId: id, ROLLNO: ROLLNO });
        if (existingStudent) {
            return res.json({ 
                success: false, 
                message: 'A student with this roll number already exists in this class.' 
            });
        }
        
        const newStudent = new Student({ NAME, ROLLNO, classId: id });
        await newStudent.save();
        
        res.json({ 
            success: true, 
            student: newStudent,
            message: 'Student added successfully!' 
        });
    } catch (err) {
        console.error(err);
        res.json({ 
            success: false, 
            message: 'Failed to add student.' 
        });
    }
});

// Add Bulk Students to Class
app.post('/classdetail/:id/addbulkstudents', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { students } = req.body;
        
        // Check if class exists and user has access
        const foundClass = await Class.findById(id);
        if (!foundClass) {
            return res.json({ success: false, message: 'Class not found.' });
        }
        
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Access denied.' });
        }
        
        if (!students || !Array.isArray(students)) {
            return res.json({ 
                success: false, 
                message: 'Invalid students data.' 
            });
        }
        
        const addedStudents = [];
        const errors = [];
        
        for (const studentData of students) {
            try {
                // Check if roll number already exists
                const existingStudent = await Student.findOne({ 
                    classId: id, 
                    ROLLNO: studentData.ROLLNO 
                });
                
                if (existingStudent) {
                    errors.push(`Roll number ${studentData.ROLLNO} already exists`);
                    continue;
                }
                
                const newStudent = new Student({ 
                    NAME: studentData.NAME, 
                    ROLLNO: studentData.ROLLNO, 
                    classId: id 
                });
                await newStudent.save();
                addedStudents.push(newStudent);
            } catch (error) {
                errors.push(`Failed to add ${studentData.NAME}: ${error.message}`);
            }
        }
        
        res.json({ 
            success: true, 
            students: addedStudents,
            addedCount: addedStudents.length,
            errors: errors,
            message: `Successfully added ${addedStudents.length} students.` 
        });
    } catch (err) {
        console.error(err);
        res.json({ 
            success: false, 
            message: 'Failed to add students.' 
        });
    }
});

// Delete Student from Class (AJAX)
app.post('/classdetail/:classId/deletestudent/:studentId', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { classId, studentId } = req.params;
        
        // Check if class exists and user has access
        const foundClass = await Class.findById(classId);
        if (!foundClass) {
            return res.json({ success: false, message: 'Class not found.' });
        }
        
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Access denied.' });
        }
        
        await Student.findByIdAndDelete(studentId);
        res.json({ success: true, message: 'Student deleted successfully!' });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Failed to delete student.' });
    }
});

// Students Management Page
app.get('/classdetail/:id/students', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const foundClass = await Class.findById(id);
        
        if (!foundClass) {
            return res.status(404).send('Class not found');
        }
        
        // Check if user has access to this class
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied');
        }
        
        const students = await Student.find({ classId: id });
        res.render('students.ejs', { 
            classDetail: foundClass, 
            students: students,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Student Registration QR Code Page
app.get('/classdetail/:id/student-registration', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const foundClass = await Class.findById(id);
        
        if (!foundClass) {
            return res.status(404).send('Class not found');
        }
        
        // Check if user has access to this class
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied');
        }
        
        res.render('student-registration.ejs', { 
            classDetail: foundClass,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Student Registration Form (for QR code)
app.get('/student-register/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const foundClass = await Class.findById(classId);
        if (!foundClass) {
            return res.status(404).send('Class not found');
        }
        res.render('student-register.ejs', { 
            classDetail: foundClass
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Student Self Registration
app.post('/student-register/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { NAME, ROLLNO, EMAIL } = req.body;
        
        // Validate required fields
        if (!NAME || !ROLLNO) {
            return res.json({ 
                success: false, 
                message: 'Name and Roll Number are required.' 
            });
        }
        
        // Validate class exists
        const foundClass = await Class.findById(classId);
        if (!foundClass) {
            return res.json({ 
                success: false, 
                message: 'Class not found.' 
            });
        }
        
        // Check if roll number already exists in this class
        const existingStudent = await Student.findOne({ classId: classId, ROLLNO: ROLLNO });
        if (existingStudent) {
            return res.json({ 
                success: false, 
                message: 'A student with this roll number already exists in this class.' 
            });
        }
        
        const newStudent = new Student({ 
            NAME, 
            ROLLNO, 
            classId: classId,
            ...(EMAIL && { EMAIL }) // Only add email if provided
        });
        await newStudent.save();
        
        console.log(`✅ Student registered: ${NAME} (${ROLLNO}) for class: ${foundClass.CLASSNAME}`);
        
        res.json({ 
            success: true, 
            student: newStudent,
            message: 'Registration successful! You have been added to the class.' 
        });
    } catch (err) {
        console.error('❌ Student registration error:', err.message);
        res.json({ 
            success: false, 
            message: 'Failed to register. Please try again.' 
        });
    }
});

// Attendance Marking Page
app.get('/classdetail/:id/attendance-mark', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const foundClass = await Class.findById(id);
        
        if (!foundClass) {
            return res.status(404).send('Class not found');
        }
        
        // Check if user has access to this class
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied');
        }
        
        const students = await Student.find({ classId: id });
        res.render('attendance-mark.ejs', { 
            classDetail: foundClass, 
            students: students,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Attendance Report Page
app.get('/classdetail/:classId/attendance-report', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { classId } = req.params;
        const { date } = req.query;
        const foundClass = await Class.findById(classId);
        
        if (!foundClass) {
            return res.status(404).send('Class not found');
        }
        
        // Check if user has access to this class
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied');
        }
        
        const students = await Student.find({ classId });

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999);
            
            const attendances = await Attendance.find({
                classId,
                date: { $gte: startOfDay, $lte: endOfDay }
            }).populate('studentId');

            const presentStudentIds = attendances.filter(att => att.status === 'present').map(att => att.studentId._id.toString());
            const absentStudents = students.filter(student => !presentStudentIds.includes(student._id.toString()));
            const totalLectures = attendances.length > 0 ? attendances[0].lectures : 0;

            res.render('attendance-report.ejs', {
                reportData: {
                    class: foundClass,
                    students,
                    attendances,
                    absentStudents,
                    totalLectures,
                    totalStudents: students.length,
                    selectedDate: date
                },
                user: req.user
            });
        } else {
            res.render('attendance-report.ejs', {
                reportData: {
                    class: foundClass,
                    students,
                    attendances: [],
                    absentStudents: [],
                    totalLectures: 0,
                    totalStudents: students.length,
                    selectedDate: null
                },
                user: req.user
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Bulk Mark Attendance
app.post('/classdetail/:classId/markattendance-bulk', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { classId } = req.params;
        const { date, lectures } = req.body;
        
        // Check if class exists and user has access
        const foundClass = await Class.findById(classId);
        if (!foundClass) {
            return res.json({ success: false, message: 'Class not found.' });
        }
        
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Access denied.' });
        }
        
        const students = await Student.find({ classId: classId });
        
        // Clear existing attendance for this date
        await Attendance.deleteMany({ 
            classId: classId, 
            date: { 
                $gte: new Date(date + 'T00:00:00.000Z'), 
                $lte: new Date(date + 'T23:59:59.999Z') 
            } 
        });

        // Mark attendance for each student
        for (const student of students) {
            const attendanceKey = `attendance_${student._id}`;
            const status = req.body[attendanceKey] || 'absent'; // Default to absent if not marked
            
            const newAttendance = new Attendance({
                studentId: student._id,
                classId: classId,
                status: status,
                lectures: parseInt(lectures),
                date: new Date(date)
            });
            await newAttendance.save();
        }

        res.redirect(`/classdetail/${classId}/attendance-report?date=${date}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to mark attendance.');
    }
});

// ====================== ADMIN ROUTES ====================== //

// Admin management routes
app.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-PASSWORD').sort({ CREATEDAT: -1 });
        res.render('admin-users', { users, user: req.user });
    } catch (err) {
        console.error('Error loading users:', err);
        res.status(500).render('error', { message: 'Failed to load users', user: req.user });
    }
});

app.get('/admin/classes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const classes = await Class.find().populate('CREATEDBY', 'FULLNAME USERNAME EMAIL').sort({ createdAt: -1 });
        res.render('admin-classes', { classes, user: req.user });
    } catch (err) {
        console.error('Error loading classes:', err);
        res.status(500).render('error', { message: 'Failed to load classes', user: req.user });
    }
});

app.get('/admin/students', requireAuth, requireAdmin, async (req, res) => {
    try {
        const students = await Student.find().populate('classId', 'CLASSNAME').sort({ createdAt: -1 });
        res.render('admin-students', { students, user: req.user });
    } catch (err) {
        console.error('Error loading students:', err);
        res.status(500).render('error', { message: 'Failed to load students', user: req.user });
    }
});

app.get('/admin/attendance', requireAuth, requireAdmin, async (req, res) => {
    try {
        const attendance = await Attendance.find()
            .populate('studentId', 'NAME ROLLNUMBER')
            .populate('classId', 'CLASSNAME')
            .sort({ date: -1 });
        res.render('admin-attendance', { attendance, user: req.user });
    } catch (err) {
        console.error('Error loading attendance:', err);
        res.status(500).render('error', { message: 'Failed to load attendance', user: req.user });
    }
});



// Secret admin route
app.get('/admin-panel9920867077@AdilAbullahaUroojFatir', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Check if user is active
        if (!req.user.ISACTIVE) {
            return res.status(403).render('error', { 
                message: 'Access Denied: Account is deactivated', 
                user: req.user 
            });
        }

        // Ensure only one admin exists
        const adminUsers = await User.find({ ROLE: 'admin' });
        if (adminUsers.length > 1) {
            console.log(`⚠️  Multiple admins detected (${adminUsers.length}). Cleaning up...`);
            const adminToKeep = adminUsers[0];
            await User.deleteMany({ ROLE: 'admin', _id: { $ne: adminToKeep._id } });
            console.log(`✅ Kept admin: ${adminToKeep.USERNAME}`);
        }

        // Fetch system statistics
        const totalUsers = await User.countDocuments();
        const totalClasses = await Class.countDocuments();
        const totalStudents = await Student.countDocuments();
        const totalAttendance = await Attendance.countDocuments();

        // Fetch recent data for admin panel
        const users = await User.find().select('-PASSWORD').sort({ CREATEDAT: -1 }).limit(5);
        const allClasses = await Class.find().populate('CREATEDBY', 'FULLNAME USERNAME').sort({ createdAt: -1 }).limit(5);
        const allStudents = await Student.find().populate('classId', 'CLASSNAME').sort({ createdAt: -1 }).limit(5);
        const allAttendance = await Attendance.find()
            .populate('studentId', 'NAME ROLLNO')
            .populate('classId', 'CLASSNAME')
            .sort({ date: -1 })
            .limit(10);

        // Calculate recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentUsers = await User.countDocuments({ CREATEDAT: { $gte: sevenDaysAgo } });
        const recentClasses = await Class.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
        const recentStudents = await Student.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
        const recentAttendance = await Attendance.countDocuments({ date: { $gte: sevenDaysAgo } });

        // Get teacher statistics
        const teacherStats = await Class.aggregate([
            {
                $group: {
                    _id: '$CREATEDBY',
                    classCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'teacher'
                }
            },
            {
                $unwind: '$teacher'
            },
            {
                $project: {
                    teacherName: '$teacher.FULLNAME',
                    teacherEmail: '$teacher.EMAIL',
                    classCount: 1,
                    totalStudents: 1
                }
            },
            {
                $sort: { classCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        res.render('admin', {
            user: req.user,
            totalUsers,
            totalClasses,
            totalStudents,
            totalAttendance,
            recentUsers,
            recentClasses,
            recentStudents,
            recentAttendance,
            users,
            allClasses,
            allStudents,
            allAttendance,
            teacherStats,
            process
        });
    } catch (err) {
        console.error('❌ Admin panel error:', err.message);
        res.status(500).render('error', { 
            message: 'Failed to load admin panel', 
            user: req.user 
        });
    }
});

// Test admin route (for debugging - remove in production)
// app.get('/test-admin', requireAuth, (req, res) => {
//     res.json({
//         authenticated: true,
//         user: {
//             username: req.user.USERNAME,
//             role: req.user.ROLE,
//             active: req.user.ISACTIVE
//         }
//     });
// });

// Emergency admin creation route (removed for security)
// Use environment variables for emergency admin creation
// See SECURE_DEPLOYMENT.md for setup instructions

// No admin access page - completely hidden

// ====================== STUDENT PORTAL ROUTES ====================== //

// Student Portal Landing Page
app.get('/student-portal', async (req, res) => {
    try {
        const { rollno } = req.query;
        
        // If rollno is provided in query (from QR code), automatically process it
        if (rollno) {
            const student = await Student.findOne({ ROLLNO: rollno }).populate('classId');
            
            if (!student) {
                return res.render('student-portal', { 
                    message: 'Student not found. Please check your roll number.', 
                    messageType: 'error',
                    rollno: rollno
                });
            }
            
            // Get attendance data
            const attendanceRecords = await Attendance.find({ studentId: student._id }).sort({ date: -1 });
            const totalDays = attendanceRecords.length;
            const presentDays = attendanceRecords.filter(record => record.status === 'present').length;
            const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
            
            // Get timetable
            const timetable = await Timetable.find({ classId: student.classId._id }).sort({ day: 1, startTime: 1 });
            
            // Generate QR code for student portal access
            const studentPortalUrl = `${req.protocol}://${req.get('host')}/student-portal?rollno=${student.ROLLNO}`;
            const qrCodeDataUrl = await QRCode.toDataURL(studentPortalUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#667eea',
                    light: '#FFFFFF'
                },
                width: 256
            });
            
            return res.render('student-dashboard', {
                student: student,
                allStudents: [student], // Single student in array for consistency
                classDetail: student.classId,
                attendanceHistory: attendanceRecords,
                allAttendanceHistory: attendanceRecords,
                attendancePercentage: attendancePercentage,
                presentDays: presentDays,
                totalDays: totalDays,
                timetable: timetable,
                qrCode: qrCodeDataUrl,
                portalUrl: studentPortalUrl
            });
        }
        
        res.render('student-portal', { message: null, messageType: null, rollno: null });
    } catch (error) {
        console.error('Student portal GET error:', error);
        res.render('student-portal', { 
            message: 'An error occurred. Please try again.', 
            messageType: 'error',
            rollno: null
        });
    }
});

// Handle Student Portal Access
app.post('/student-portal', async (req, res) => {
    try {
        const { rollno } = req.body;
        
        if (!rollno) {
            return res.render('student-portal', { 
                message: 'Please enter your roll number', 
                messageType: 'error',
                rollno: null
            });
        }
        
        // Find student by roll number - could be in multiple classes
        const students = await Student.find({ ROLLNO: rollno }).populate('classId').populate('CLASSES');
        
        if (!students || students.length === 0) {
            return res.render('student-portal', { 
                message: 'Student not found. Please check your roll number.', 
                messageType: 'error',
                rollno: rollno
            });
        }
        
        // If student is in multiple classes, show class selection
        if (students.length > 1) {
            return res.render('student-class-selection', {
                students: students,
                rollno: rollno
            });
        }
        
        // Single class - proceed with original logic
        const student = students[0];
        
        // Get attendance data for all classes this student is in
        const allAttendanceRecords = await Attendance.find({ 
            studentId: { $in: students.map(s => s._id) } 
        }).populate('studentId').sort({ date: -1 });
        
        // Get attendance for primary class
        const primaryAttendanceRecords = await Attendance.find({ studentId: student._id }).sort({ date: -1 });
        const totalDays = primaryAttendanceRecords.length;
        const presentDays = primaryAttendanceRecords.filter(record => record.status === 'present').length;
        const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
        
        // Get timetables for all classes
        const allClassIds = students.map(s => s.classId._id);
        const allTimetables = await Timetable.find({ 
            classId: { $in: allClassIds } 
        }).populate('classId').sort({ day: 1, startTime: 1 });
        
        // Generate QR code for student portal access
        const studentPortalUrl = `${req.protocol}://${req.get('host')}/student-portal?rollno=${student.ROLLNO}`;
        const qrCodeDataUrl = await QRCode.toDataURL(studentPortalUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#667eea',
                light: '#FFFFFF'
            },
            width: 256
        });
        
        res.render('student-dashboard', {
            student: student,
            allStudents: students, // All student records for this roll number
            classDetail: student.classId,
            attendanceHistory: primaryAttendanceRecords,
            allAttendanceHistory: allAttendanceRecords,
            attendancePercentage: attendancePercentage,
            presentDays: presentDays,
            totalDays: totalDays,
            timetable: allTimetables,
            qrCode: qrCodeDataUrl,
            portalUrl: studentPortalUrl
        });
    } catch (error) {
        console.error('Student portal error:', error);
        res.render('student-portal', { 
            message: 'An error occurred. Please try again.', 
            messageType: 'error',
            rollno: null
        });
    }
});

// Individual Student Dashboard (for multi-class students) - Public access for students
app.get('/student-dashboard/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Find the specific student record
        const student = await Student.findById(studentId).populate('classId');
        
        if (!student) {
            return res.status(404).render('error', {
                message: 'Student record not found',
                user: null
            });
        }
        
        // Find all student records with the same roll number
        const allStudents = await Student.find({ ROLLNO: student.ROLLNO }).populate('classId');
        
        // Get attendance data for this specific student
        const attendanceRecords = await Attendance.find({ studentId: student._id }).sort({ date: -1 });
        const totalDays = attendanceRecords.length;
        const presentDays = attendanceRecords.filter(record => record.status === 'present').length;
        const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
        
        // Get attendance for all classes this student is in
        const allAttendanceRecords = await Attendance.find({ 
            studentId: { $in: allStudents.map(s => s._id) } 
        }).populate('studentId').sort({ date: -1 });
        
        // Get timetables for all classes
        const allClassIds = allStudents.map(s => s.classId._id);
        const allTimetables = await Timetable.find({ 
            classId: { $in: allClassIds } 
        }).populate('classId').sort({ day: 1, startTime: 1 });
        
        // Generate QR code for student portal access
        const studentPortalUrl = `${req.protocol}://${req.get('host')}/student-portal?rollno=${student.ROLLNO}`;
        const qrCodeDataUrl = await QRCode.toDataURL(studentPortalUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#667eea',
                light: '#FFFFFF'
            },
            width: 256
        });
        
        res.render('student-dashboard', {
            student: student,
            allStudents: allStudents,
            classDetail: student.classId,
            attendanceHistory: attendanceRecords,
            allAttendanceHistory: allAttendanceRecords,
            attendancePercentage: attendancePercentage,
            presentDays: presentDays,
            totalDays: totalDays,
            timetable: allTimetables,
            qrCode: qrCodeDataUrl,
            portalUrl: studentPortalUrl
        });
        
    } catch (error) {
        console.error('Individual student dashboard error:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading the dashboard',
            user: null
        });
    }
});

// Generate QR Code for Student (Teacher Route)
app.get('/student/:studentId/qrcode', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { studentId } = req.params;
        const student = await Student.findById(studentId).populate('classId');
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Check if user has access to this student's class
        if (req.user.ROLE !== 'admin' && student.classId.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Generate QR code for student portal access
        const studentPortalUrl = `${req.protocol}://${req.get('host')}/student-portal?rollno=${student.ROLLNO}`;
        const qrCodeDataUrl = await QRCode.toDataURL(studentPortalUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#667eea',
                light: '#FFFFFF'
            },
            width: 256
        });
        
        res.json({
            success: true,
            student: {
                name: student.NAME,
                rollno: student.ROLLNO,
                class: student.classId.CLASSNAME
            },
            qrCode: qrCodeDataUrl,
            portalUrl: studentPortalUrl
        });
    } catch (error) {
        console.error('QR Code generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Test route to show QR codes for all students (for development/testing)
app.get('/test-qr-codes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const students = await Student.find().populate('classId').limit(10);
        const qrCodes = [];
        
        for (const student of students) {
            const studentPortalUrl = `${req.protocol}://${req.get('host')}/student-portal?rollno=${student.ROLLNO}`;
            const qrCodeDataUrl = await QRCode.toDataURL(studentPortalUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#667eea',
                    light: '#FFFFFF'
                },
                width: 200
            });
            
            qrCodes.push({
                student: student,
                qrCode: qrCodeDataUrl,
                url: studentPortalUrl
            });
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code Test Page</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                    .qr-item { 
                        background: white; 
                        margin: 20px 0; 
                        padding: 20px; 
                        border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        display: flex;
                        align-items: center;
                        gap: 20px;
                    }
                    .qr-info { flex: 1; }
                    .qr-code img { border-radius: 10px; }
                    h1 { color: #333; text-align: center; }
                    .instructions { 
                        background: #e3f2fd; 
                        padding: 15px; 
                        border-radius: 10px; 
                        margin-bottom: 20px;
                        color: #0d47a1;
                    }
                    .url { font-size: 12px; color: #666; word-break: break-all; }
                </style>
            </head>
            <body>
                <h1>🔍 QR Code Test Page</h1>
                <div class="instructions">
                    <strong>📱 How to test:</strong>
                    <ol>
                        <li>Use your phone's camera or QR scanner app</li>
                        <li>Scan any QR code below</li>
                        <li>You'll be redirected to that student's portal</li>
                        <li>Or click the URLs directly to test</li>
                    </ol>
                </div>
                
                ${qrCodes.map(item => `
                    <div class="qr-item">
                        <div class="qr-info">
                            <h3>${item.student.NAME}</h3>
                            <p><strong>Roll No:</strong> ${item.student.ROLLNO}</p>
                            <p><strong>Class:</strong> ${item.student.classId.CLASSNAME} - ${item.student.classId.SUBJECT}</p>
                            <div class="url">
                                <strong>URL:</strong> <a href="${item.url}" target="_blank">${item.url}</a>
                            </div>
                        </div>
                        <div class="qr-code">
                            <img src="${item.qrCode}" alt="QR Code for ${item.student.NAME}" />
                        </div>
                    </div>
                `).join('')}
                
                <div style="text-align: center; margin-top: 40px;">
                    <a href="/" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        ← Back to Home
                    </a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Test QR codes error:', error);
        res.status(500).send('Error generating test QR codes');
    }
});

// ====================== ATTENDANCE SUMMARY ROUTES ====================== //

// Student Attendance Summary Table (Public access for students without login)
app.get('/student-attendance-summary', async (req, res) => {
    try {
        const { rollno } = req.query;
        
        if (!rollno) {
            return res.render('student-attendance-summary', { 
                message: 'Please enter your roll number to view attendance summary.', 
                messageType: 'info',
                rollno: null,
                attendanceSummary: null
            });
        }
        
        // Find all student records with this roll number
        const students = await Student.find({ ROLLNO: rollno }).populate('classId');
        
        if (!students || students.length === 0) {
            return res.render('student-attendance-summary', { 
                message: 'Student not found. Please check your roll number.', 
                messageType: 'error',
                rollno: rollno,
                attendanceSummary: null
            });
        }
        
        // Get attendance data for all classes
        const attendanceSummary = [];
        let totalPresent = 0;
        let totalClasses = 0;
        
        for (const student of students) {
            const attendanceRecords = await Attendance.find({ studentId: student._id });
            const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
            const totalCount = attendanceRecords.length;
            const percentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(2) : 0;
            
            attendanceSummary.push({
                className: student.classId.CLASSNAME,
                subject: student.classId.SUBJECT,
                roomNo: student.classId.ROOMNO,
                presentCount: presentCount,
                totalCount: totalCount,
                percentage: percentage,
                status: percentage >= 75 ? 'good' : percentage >= 60 ? 'warning' : 'danger'
            });
            
            totalPresent += presentCount;
            totalClasses += totalCount;
        }
        
        const overallPercentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(2) : 0;
        
        res.render('student-attendance-summary', {
            message: null,
            messageType: null,
            rollno: rollno,
            studentName: students[0].NAME,
            attendanceSummary: attendanceSummary,
            totalPresent: totalPresent,
            totalClasses: totalClasses,
            overallPercentage: overallPercentage,
            overallStatus: overallPercentage >= 75 ? 'good' : overallPercentage >= 60 ? 'warning' : 'danger'
        });
        
    } catch (error) {
        console.error('Student attendance summary error:', error);
        res.status(500).render('student-attendance-summary', {
            message: 'An error occurred while loading attendance summary.',
            messageType: 'error',
            rollno: null,
            attendanceSummary: null
        });
    }
});

// Student-specific attendance report (public access)
app.get('/student-attendance-report/:rollno', async (req, res) => {
    try {
        const { rollno } = req.params;

        if (!rollno) {
            return res.status(400).render('error', {
                message: 'Roll number is required',
                user: null
            });
        }

        // Find all student records with this roll number
        const students = await Student.find({ ROLLNO: rollno }).populate('classId');

        if (!students || students.length === 0) {
            return res.status(404).render('error', {
                message: 'Student not found with roll number: ' + rollno,
                user: null
            });
        }

        // Get attendance data for all classes this student is in
        const attendanceSummary = [];
        let totalPresent = 0;
        let totalClasses = 0;

        for (const student of students) {
            const attendanceRecords = await Attendance.find({ studentId: student._id }).sort({ date: -1 });
            const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
            const totalCount = attendanceRecords.length;
            const percentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(2) : 0;

            attendanceSummary.push({
                student: student,
                classDetail: student.classId,
                presentCount: presentCount,
                totalCount: totalCount,
                percentage: parseFloat(percentage),
                status: percentage >= 75 ? 'good' : percentage >= 60 ? 'warning' : 'danger',
                attendanceRecords: attendanceRecords
            });

            totalPresent += presentCount;
            totalClasses += totalCount;
        }

        const overallPercentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(2) : 0;

        res.render('student-attendance-summary', {
            message: null,
            messageType: null,
            rollno: rollno,
            studentName: students[0].NAME,
            attendanceSummary: attendanceSummary,
            totalPresent: totalPresent,
            totalClasses: totalClasses,
            overallPercentage: overallPercentage,
            overallStatus: overallPercentage >= 75 ? 'good' : overallPercentage >= 60 ? 'warning' : 'danger'
        });

    } catch (error) {
        console.error('Student attendance report error:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading attendance report.',
            user: null
        });
    }
});

// Teacher Attendance Summary Table
app.get('/teacher-attendance-summary', requireAuth, requireTeacher, async (req, res) => {
    try {
        // Get all classes where the teacher has access
        const teacherClasses = await Class.find({
            $or: [
                { CREATEDBY: req.user._id },
                { TEACHERS: req.user._id }
            ],
            ISACTIVE: true
        }).populate('TEACHERS', 'NAME EMAIL');
        
        const attendanceSummary = [];
        let totalStudents = 0;
        let totalPresentInstances = 0;
        let totalClassInstances = 0;
        
        for (const classDoc of teacherClasses) {
            // Get all students in this class
            const students = await Student.find({ classId: classDoc._id });
            
            // Get attendance statistics for this class
            const attendanceRecords = await Attendance.find({ 
                studentId: { $in: students.map(s => s._id) }
            });
            
            const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
            const totalAttendanceRecords = attendanceRecords.length;
            const classPercentage = totalAttendanceRecords > 0 ? ((presentCount / totalAttendanceRecords) * 100).toFixed(2) : 0;
            
            // Get unique dates for this class
            const uniqueDates = [...new Set(attendanceRecords.map(record => record.date.toDateString()))];
            const totalClassDays = uniqueDates.length;
            
            attendanceSummary.push({
                classId: classDoc._id,
                className: classDoc.CLASSNAME,
                subject: classDoc.SUBJECT,
                roomNo: classDoc.ROOMNO,
                totalStudents: students.length,
                totalClassDays: totalClassDays,
                presentCount: presentCount,
                totalAttendanceRecords: totalAttendanceRecords,
                percentage: classPercentage,
                status: classPercentage >= 75 ? 'good' : classPercentage >= 60 ? 'warning' : 'danger',
                teachers: classDoc.TEACHERS
            });
            
            totalStudents += students.length;
            totalPresentInstances += presentCount;
            totalClassInstances += totalAttendanceRecords;
        }
        
        const overallPercentage = totalClassInstances > 0 ? ((totalPresentInstances / totalClassInstances) * 100).toFixed(2) : 0;
        
        res.render('teacher-attendance-summary', {
            teacherName: req.user.NAME,
            attendanceSummary: attendanceSummary,
            totalClasses: teacherClasses.length,
            totalStudents: totalStudents,
            totalPresentInstances: totalPresentInstances,
            totalClassInstances: totalClassInstances,
            overallPercentage: overallPercentage,
            overallStatus: overallPercentage >= 75 ? 'good' : overallPercentage >= 60 ? 'warning' : 'danger'
        });
        
    } catch (error) {
        console.error('Teacher attendance summary error:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading attendance summary.',
            user: req.user
        });
    }
});

// Teacher view of student attendance summary
app.get('/teacher-view-student/:rollno', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { rollno } = req.params;
        
        // Find all student records with this roll number
        const students = await Student.find({ ROLLNO: rollno }).populate('classId');
        
        if (!students || students.length === 0) {
            return res.render('teacher-view-student-summary', { 
                message: 'Student not found with roll number: ' + rollno, 
                messageType: 'error',
                rollno: rollno,
                studentData: null,
                teacherName: req.user.NAME
            });
        }
        
        // Check if teacher has access to at least one of the student's classes
        const teacherClasses = await Class.find({
            $or: [
                { CREATEDBY: req.user._id },
                { TEACHERS: req.user._id }
            ]
        });
        
        const teacherClassIds = teacherClasses.map(c => c._id.toString());
        const studentClassIds = students.map(s => s.classId._id.toString());
        const hasAccess = studentClassIds.some(id => teacherClassIds.includes(id));
        
        if (!hasAccess) {
            return res.render('teacher-view-student-summary', { 
                message: 'You do not have access to view this student\'s attendance.', 
                messageType: 'error',
                rollno: rollno,
                studentData: null,
                teacherName: req.user.NAME
            });
        }
        
        // Get attendance data for all classes
        const attendanceSummary = [];
        let totalPresent = 0;
        let totalClasses = 0;
        
        for (const student of students) {
            const attendanceRecords = await Attendance.find({ studentId: student._id });
            const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
            const totalCount = attendanceRecords.length;
            const percentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(2) : 0;
            
            // Check if teacher has access to this specific class
            const hasClassAccess = teacherClassIds.includes(student.classId._id.toString());
            
            attendanceSummary.push({
                className: student.classId.CLASSNAME,
                subject: student.classId.SUBJECT,
                roomNo: student.classId.ROOMNO,
                classCode: student.classId.CLASSCODE,
                presentCount: presentCount,
                totalCount: totalCount,
                percentage: percentage,
                status: percentage >= 75 ? 'good' : percentage >= 60 ? 'warning' : 'danger',
                hasAccess: hasClassAccess,
                classId: student.classId._id
            });
            
            totalPresent += presentCount;
            totalClasses += totalCount;
        }
        
        const overallPercentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100).toFixed(2) : 0;
        
        res.render('teacher-view-student-summary', {
            message: null,
            messageType: null,
            rollno: rollno,
            studentData: {
                name: students[0].NAME,
                rollno: rollno,
                attendanceSummary: attendanceSummary,
                totalPresent: totalPresent,
                totalClasses: totalClasses,
                overallPercentage: overallPercentage,
                overallStatus: overallPercentage >= 75 ? 'good' : overallPercentage >= 60 ? 'warning' : 'danger'
            },
            teacherName: req.user.NAME
        });
        
    } catch (error) {
        console.error('Teacher view student summary error:', error);
        res.status(500).render('teacher-view-student-summary', {
            message: 'An error occurred while loading student attendance summary.',
            messageType: 'error',
            rollno: req.params.rollno,
            studentData: null,
            teacherName: req.user.NAME
        });
    }
});

// Teacher search students page
app.get('/teacher-search-students', requireAuth, requireTeacher, async (req, res) => {
    try {
        // Get all classes where the teacher has access
        const teacherClasses = await Class.find({
            $or: [
                { CREATEDBY: req.user._id },
                { TEACHERS: req.user._id }
            ],
            ISACTIVE: true
        }).populate('TEACHERS', 'NAME EMAIL');
        
        // Get all students from teacher's classes
        const classIds = teacherClasses.map(c => c._id);
        const students = await Student.find({ 
            classId: { $in: classIds } 
        }).populate('classId', 'CLASSNAME SUBJECT CLASSCODE ROOMNO');
        
        // Group students by class for better organization
        const studentsByClass = {};
        students.forEach(student => {
            const classId = student.classId._id.toString();
            if (!studentsByClass[classId]) {
                studentsByClass[classId] = {
                    classInfo: student.classId,
                    students: []
                };
            }
            studentsByClass[classId].students.push(student);
        });
        
        res.render('teacher-search-students', {
            teacherClasses: teacherClasses,
            studentsByClass: studentsByClass,
            teacherName: req.user.NAME,
            totalStudents: students.length
        });
        
    } catch (error) {
        console.error('Teacher search students error:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading students.',
            user: req.user
        });
    }
});

// Enhanced class management - Add multiple classes at once
app.get('/bulk-create-classes', requireAuth, requireTeacher, (req, res) => {
    res.render('bulk-create-classes', {
        user: req.user,
        message: null,
        messageType: null
    });
});

app.post('/bulk-create-classes', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { classes } = req.body;
        
        if (!classes || !Array.isArray(classes) || classes.length === 0) {
            return res.render('bulk-create-classes', {
                user: req.user,
                message: 'Please provide at least one class to create.',
                messageType: 'error'
            });
        }
        
        const createdClasses = [];
        const errors = [];
        
        for (let i = 0; i < classes.length; i++) {
            const classData = classes[i];
            
            try {
                // Validate required fields
                if (!classData.CLASSNAME || !classData.SUBJECT || !classData.ROOMNO) {
                    errors.push(`Class ${i + 1}: Missing required fields`);
                    continue;
                }
                
                const newClass = new Class({
                    CLASSNAME: classData.CLASSNAME.trim(),
                    ROOMNO: parseInt(classData.ROOMNO),
                    SUBJECT: classData.SUBJECT.trim(),
                    DESCRIPTION: classData.DESCRIPTION ? classData.DESCRIPTION.trim() : '',
                    CREATEDBY: req.user._id,
                    ISACTIVE: true
                });
                
                await newClass.save();
                createdClasses.push(newClass);
                
            } catch (error) {
                console.error(`Error creating class ${i + 1}:`, error);
                errors.push(`Class ${i + 1}: ${error.message}`);
            }
        }
        
        let message = '';
        let messageType = 'success';
        
        if (createdClasses.length > 0) {
            message += `Successfully created ${createdClasses.length} class(es). `;
        }
        
        if (errors.length > 0) {
            message += `${errors.length} error(s): ${errors.join(', ')}`;
            messageType = createdClasses.length > 0 ? 'warning' : 'error';
        }
        
        res.render('bulk-create-classes', {
            user: req.user,
            message: message,
            messageType: messageType,
            createdClasses: createdClasses
        });
        
    } catch (error) {
        console.error('Bulk create classes error:', error);
        res.render('bulk-create-classes', {
            user: req.user,
            message: 'An error occurred while creating classes: ' + error.message,
            messageType: 'error'
        });
    }
});

// ====================== STUDENT MANAGEMENT & REPORTS ====================== //

// Teacher view of all students' attendance summary
app.get('/teacher-students-summary', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { classId } = req.query;
        
        // Get all classes where the teacher has access
        const teacherClasses = await Class.find({
            $or: [
                { CREATEDBY: req.user._id },
                { TEACHERS: req.user._id }
            ],
            ISACTIVE: true
        });

        let selectedClass = null;
        let studentsData = [];

        if (classId) {
            // Get specific class data
            selectedClass = await Class.findById(classId);
            if (!selectedClass || (!selectedClass.CREATEDBY.equals(req.user._id) && !selectedClass.TEACHERS.includes(req.user._id))) {
                return res.status(403).render('error', {
                    message: 'You do not have access to this class.',
                    user: req.user
                });
            }

            // Get all students in this class
            const students = await Student.find({ classId: classId }).sort({ ROLLNO: 1 });
            
            for (const student of students) {
                const attendanceRecords = await Attendance.find({ studentId: student._id });
                const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
                const totalCount = attendanceRecords.length;
                const percentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(2) : 0;
                
                studentsData.push({
                    student: student,
                    presentCount: presentCount,
                    totalCount: totalCount,
                    percentage: parseFloat(percentage),
                    status: percentage >= 75 ? 'good' : percentage >= 60 ? 'warning' : 'danger',
                    isDefaulter: percentage < 75
                });
            }
        }

        res.render('teacher-students-summary', {
            teacherClasses: teacherClasses,
            selectedClass: selectedClass,
            studentsData: studentsData,
            user: req.user
        });

    } catch (error) {
        console.error('Teacher students summary error:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading students summary.',
            user: req.user
        });
    }
});



// Bulk add students to multiple classes
app.post('/bulk-add-students', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { students, classIds } = req.body;
        
        if (!students || !classIds || !Array.isArray(students) || !Array.isArray(classIds)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // Verify teacher has access to all specified classes
        const classes = await Class.find({
            _id: { $in: classIds },
            $or: [
                { CREATEDBY: req.user._id },
                { TEACHERS: req.user._id }
            ]
        });

        if (classes.length !== classIds.length) {
            return res.status(403).json({ error: 'You do not have access to all specified classes.' });
        }

        const results = [];
        
        for (const studentData of students) {
            for (const classId of classIds) {
                try {
                    // Check if student already exists in this class
                    const existingStudent = await Student.findOne({
                        ROLLNO: studentData.rollNo,
                        classId: classId
                    });

                    if (!existingStudent) {
                        const newStudent = new Student({
                            NAME: studentData.name,
                            ROLLNO: studentData.rollNo,
                            EMAIL: studentData.email,
                            classId: classId,
                            CLASSES: [classId]
                        });

                        await newStudent.save();
                        results.push({
                            rollNo: studentData.rollNo,
                            classId: classId,
                            status: 'added'
                        });
                    } else {
                        results.push({
                            rollNo: studentData.rollNo,
                            classId: classId,
                            status: 'already_exists'
                        });
                    }
                } catch (error) {
                    results.push({
                        rollNo: studentData.rollNo,
                        classId: classId,
                        status: 'error',
                        error: error.message
                    });
                }
            }
        }

        res.json({
            success: true,
            message: 'Bulk student addition completed',
            results: results
        });

    } catch (error) {
        console.error('Bulk add students error:', error);
        res.status(500).json({ error: 'An error occurred while adding students.' });
    }
});

// Generate comprehensive attendance report
app.get('/generate-attendance-report', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { classId, format } = req.query;
        
        if (!classId) {
            return res.status(400).json({ error: 'Class ID is required' });
        }

        // Verify teacher has access to this class
        const classDoc = await Class.findById(classId);
        if (!classDoc || (!classDoc.CREATEDBY.equals(req.user._id) && !classDoc.TEACHERS.includes(req.user._id))) {
            return res.status(403).json({ error: 'You do not have access to this class.' });
        }

        // Get all students in this class
        const students = await Student.find({ classId: classId }).sort({ ROLLNO: 1 });
        
        // Get all unique attendance dates for this class
        const allAttendanceRecords = await Attendance.find({ 
            studentId: { $in: students.map(s => s._id) }
        }).sort({ date: 1 });
        
        const uniqueDates = [...new Set(allAttendanceRecords.map(record => record.date.toDateString()))];
        
        const reportData = {
            class: classDoc,
            generatedBy: req.user.NAME,
            generatedOn: new Date(),
            totalStudents: students.length,
            totalClassDays: uniqueDates.length,
            students: [],
            defaulters: [],
            summary: {
                excellent: 0, // >= 75%
                good: 0,      // 60-74%
                poor: 0       // < 60%
            }
        };

        // Process each student
        for (const student of students) {
            const studentAttendance = await Attendance.find({ studentId: student._id }).sort({ date: 1 });
            const presentCount = studentAttendance.filter(record => record.status === 'present').length;
            const totalCount = studentAttendance.length;
            const percentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(2) : 0;
            
            // Create attendance record for each date
            const attendanceByDate = {};
            studentAttendance.forEach(record => {
                attendanceByDate[record.date.toDateString()] = record.status;
            });

            const studentData = {
                rollNo: student.ROLLNO,
                name: student.NAME,
                email: student.EMAIL,
                presentCount: presentCount,
                totalCount: totalCount,
                percentage: parseFloat(percentage),
                status: percentage >= 75 ? 'excellent' : percentage >= 60 ? 'good' : 'poor',
                isDefaulter: percentage < 75,
                attendanceByDate: attendanceByDate,
                classesAttended: uniqueDates.map(date => ({
                    date: date,
                    status: attendanceByDate[date] || 'absent'
                }))
            };

            reportData.students.push(studentData);

            // Update summary counts
            if (percentage >= 75) reportData.summary.excellent++;
            else if (percentage >= 60) reportData.summary.good++;
            else reportData.summary.poor++;

            // Add to defaulters if attendance < 75%
            if (percentage < 75) {
                reportData.defaulters.push(studentData);
            }
        }

        if (format === 'json') {
            res.json(reportData);
        } else if (format === 'csv') {
            // Generate CSV format
            let csv = [];
            csv.push(`Attendance Report - ${classDoc.CLASSNAME}`);
            csv.push(`Subject: ${classDoc.SUBJECT}`);
            csv.push(`Room: ${classDoc.ROOMNO}`);
            csv.push(`Generated by: ${req.user.NAME}`);
            csv.push(`Generated on: ${new Date().toLocaleDateString()}`);
            csv.push(`Total Students: ${reportData.totalStudents}`);
            csv.push(`Total Class Days: ${reportData.totalClassDays}`);
            csv.push('');
            
            // Student summary
            csv.push('Roll No,Name,Email,Present,Total,Percentage,Status,Is Defaulter');
            reportData.students.forEach(student => {
                csv.push(`${student.rollNo},"${student.name}","${student.email}",${student.presentCount},${student.totalCount},${student.percentage}%,${student.status},${student.isDefaulter ? 'YES' : 'NO'}`);
            });
            
            csv.push('');
            csv.push('DEFAULTERS (Below 75% Attendance):');
            csv.push('Roll No,Name,Percentage');
            reportData.defaulters.forEach(defaulter => {
                csv.push(`${defaulter.rollNo},"${defaulter.name}",${defaulter.percentage}%`);
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${classDoc.CLASSNAME}-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv.join('\n'));
        } else {
            // Render HTML report
            res.render('attendance-report', {
                reportData: reportData,
                user: req.user
            });
        }

    } catch (error) {
        console.error('Generate attendance report error:', error);
        res.status(500).json({ error: 'An error occurred while generating the report.' });
    }
});

// Bulk add students to multiple classes
app.post('/bulk-add-students', requireAuth, requireTeacher, async (req, res) => {
    try {
        const { students, classIds } = req.body;
        
        if (!students || !classIds || !Array.isArray(students) || !Array.isArray(classIds)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // Verify teacher has access to all specified classes
        const classes = await Class.find({
            _id: { $in: classIds },
            $or: [
                { CREATEDBY: req.user._id },
                { TEACHERS: req.user._id }
            ]
        });

        if (classes.length !== classIds.length) {
            return res.status(403).json({ error: 'You do not have access to all specified classes.' });
        }

        const results = [];

        // Add each student to each class
        for (const studentData of students) {
            for (const classId of classIds) {
                try {
                    // Check if student already exists in this class
                    const existingStudent = await Student.findOne({
                        ROLLNO: studentData.rollNo,
                        classId: classId
                    });

                    if (!existingStudent) {
                        const newStudent = new Student({
                            NAME: studentData.name,
                            ROLLNO: studentData.rollNo,
                            EMAIL: studentData.email,
                            classId: classId,
                            CLASSES: [classId]
                        });

                        await newStudent.save();
                        results.push({
                            rollNo: studentData.rollNo,
                            classId: classId,
                            status: 'added'
                        });
                    } else {
                        results.push({
                            rollNo: studentData.rollNo,
                            classId: classId,
                            status: 'already_exists'
                        });
                    }
                } catch (error) {
                    results.push({
                        rollNo: studentData.rollNo,
                        classId: classId,
                        status: 'error',
                        error: error.message
                    });
                }
            }
        }

        res.json({
            success: true,
            message: 'Bulk student addition completed',
            results: results
        });

    } catch (error) {
        console.error('Bulk add students error:', error);
        res.status(500).json({ error: 'An error occurred while adding students.' });
    }
});

// ====================== TEST & DEBUG ROUTES ====================== //

// Test authentication and role access
app.get('/test-auth', requireAuth, async (req, res) => {
    try {
        const userInfo = {
            id: req.user._id,
            username: req.user.USERNAME,
            role: req.user.ROLE,
            isActive: req.user.ISACTIVE,
            accessLevel: {
                canAccessAdmin: req.user.ROLE === 'admin',
                canAccessTeacher: ['admin', 'teacher'].includes(req.user.ROLE),
                canAccessStudent: req.user.ROLE === 'student',
                isBlocked: !req.user.ISACTIVE
            }
        };

        res.json({
            message: 'Authentication test successful',
            user: userInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Auth test error:', error);
        res.status(500).json({ error: 'Authentication test failed' });
    }
});

// Test database connection
app.get('/test-db', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Test basic database operations
        const userCount = await User.countDocuments();
        const classCount = await Class.countDocuments();
        const studentCount = await Student.countDocuments();
        
        res.json({
            success: true,
            message: 'Database connection is working!',
            stats: {
                users: userCount,
                classes: classCount,
                students: studentCount
            },
            currentUser: {
                id: req.user._id,
                name: req.user.NAME,
                role: req.user.ROLE
            }
        });
        
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test class creation route
app.get('/test-create-class', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Testing class creation...');
        
        const testClass = new Class({
            CLASSNAME: 'Test Class ' + Date.now(),
            ROOMNO: 101,
            SUBJECT: 'Test Subject',
            DESCRIPTION: 'This is a test class',
            CREATEDBY: req.user._id,
            ISACTIVE: true
        });
        
        console.log('Test class object before save:', testClass);
        
        await testClass.save();
        
        console.log('Test class saved successfully:', testClass);
        
        res.json({
            success: true,
            message: 'Test class created successfully!',
            class: testClass
        });
        
    } catch (error) {
        console.error('Test class creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// ====================== MIGRATION ROUTES (Run once to update existing data) ====================== //

// Migration route to update existing classes with new schema
app.get('/migrate-classes', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Update all classes to have TEACHERS array and CLASSCODE
        const classes = await Class.find({});
        let updated = 0;
        
        for (const classDoc of classes) {
            let needsUpdate = false;
            
            // Add TEACHERS array if missing
            if (!classDoc.TEACHERS || classDoc.TEACHERS.length === 0) {
                classDoc.TEACHERS = [classDoc.CREATEDBY];
                needsUpdate = true;
            }
            
            // Add CLASSCODE if missing
            if (!classDoc.CLASSCODE) {
                // Generate unique class code
                let code;
                let isUnique = false;
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                
                while (!isUnique) {
                    code = '';
                    for (let i = 0; i < 6; i++) {
                        code += characters.charAt(Math.floor(Math.random() * characters.length));
                    }
                    
                    const existingClass = await Class.findOne({ CLASSCODE: code });
                    if (!existingClass) {
                        isUnique = true;
                    }
                }
                
                classDoc.CLASSCODE = code;
                needsUpdate = true;
            }
            
            // Add ISACTIVE if missing
            if (classDoc.ISACTIVE === undefined) {
                classDoc.ISACTIVE = true;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await classDoc.save();
                updated++;
            }
        }
        
        // Update all students to have CLASSES array
        const students = await Student.find({});
        let studentsUpdated = 0;
        
        for (const student of students) {
            if (!student.CLASSES || student.CLASSES.length === 0) {
                student.CLASSES = [student.classId];
                await student.save();
                studentsUpdated++;
            }
        }
        
        res.json({
            success: true,
            message: `Migration completed successfully!`,
            classesUpdated: updated,
            studentsUpdated: studentsUpdated,
            totalClasses: classes.length,
            totalStudents: students.length
        });
        
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            error: 'Migration failed: ' + error.message
        });
    }
});

// ====================== TIMETABLE MANAGEMENT ROUTES ====================== //

// Timetable Management Page
app.get('/classdetail/:id/timetable', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const foundClass = await Class.findById(id);
        
        if (!foundClass) {
            return res.status(404).send('Class not found');
        }
        
        // Check if user has access to this class
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.status(403).send('Access denied');
        }
        
        const timetable = await Timetable.find({ classId: id }).sort({ day: 1, startTime: 1 });
        
        res.render('timetable-manage', { 
            classDetail: foundClass, 
            timetable: timetable,
            user: req.user,
            message: null,
            messageType: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Timetable Slot
app.post('/classdetail/:id/timetable/add', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { day, startTime, endTime, subject, teacher, room } = req.body;
        
        // Check if class exists and user has access
        const foundClass = await Class.findById(id);
        if (!foundClass) {
            return res.redirect(`/classdetail/${id}/timetable?error=Class not found`);
        }
        
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.redirect(`/classdetail/${id}/timetable?error=Access denied`);
        }
        
        // Validate time
        if (startTime >= endTime) {
            return res.redirect(`/classdetail/${id}/timetable?error=End time must be after start time`);
        }
        
        // Check for time conflicts
        const conflictingSlot = await Timetable.findOne({
            classId: id,
            day: day,
            $or: [
                { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
            ]
        });
        
        if (conflictingSlot) {
            return res.redirect(`/classdetail/${id}/timetable?error=Time slot conflicts with existing schedule`);
        }
        
        const newSlot = new Timetable({
            classId: id,
            day,
            startTime,
            endTime,
            subject,
            teacher,
            room,
            createdBy: req.user._id
        });
        
        await newSlot.save();
        res.redirect(`/classdetail/${id}/timetable?success=Time slot added successfully`);
    } catch (err) {
        console.error(err);
        res.redirect(`/classdetail/${id}/timetable?error=Failed to add time slot`);
    }
});

// Delete Timetable Slot
app.post('/classdetail/:classId/timetable/delete/:slotId', requireAuth, hasClassManagementAccess, async (req, res) => {
    try {
        const { classId, slotId } = req.params;
        
        // Check if class exists and user has access
        const foundClass = await Class.findById(classId);
        if (!foundClass) {
            return res.json({ success: false, message: 'Class not found' });
        }
        
        if (req.user.ROLE !== 'admin' && foundClass.CREATEDBY.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Access denied' });
        }
        
        await Timetable.findByIdAndDelete(slotId);
        res.json({ success: true, message: 'Time slot deleted successfully' });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Failed to delete time slot' });
    }
});

// Clear cache endpoint
app.post('/admin/clear-cache', requireAuth, requireAdmin, async (req, res) => {
    try {
        // In a real application, you would clear various caches here
        // For now, we'll just return success
        res.json({ success: true, message: 'Cache cleared successfully' });
    } catch (err) {
        console.error('Clear cache error:', err);
        res.json({ success: false, message: 'Failed to clear cache' });
    }
});

// Start server with MongoDB connection
async function startServer() {
    try {
        // Connect to MongoDB first
        await main();
        
        // Environment configuration
        const PORT = process.env.PORT || 3000;
        const NODE_ENV = process.env.NODE_ENV || 'development';

        app.listen(PORT, '0.0.0.0', () => {
            console.log('🚀 Server is running!');
            console.log('========================');
            console.log(`Environment: ${NODE_ENV}`);
            console.log(`Port: ${PORT}`);
            console.log('');
            
            if (NODE_ENV === 'development') {
                console.log('📍 Local Access:');
                console.log(`- Local: http://localhost:${PORT}`);
                console.log(`- Network: http://[YOUR_IP_ADDRESS]:${PORT}`);
                console.log('');
                console.log('🌐 For Live Deployment:');
                console.log('- Deploy to hosting service (Heroku, Vercel, etc.)');
                console.log('- Update QR codes to use live domain');
                console.log('- Students can access from anywhere!');
            } else {
                console.log('🌐 Live Deployment Active!');
                console.log('- Students can access from anywhere');
                console.log('- QR codes work globally');
                console.log('- No localhost restrictions');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
