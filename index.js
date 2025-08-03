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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Import Mongoose Models
const Class = require('./models/class');
const Student = require('./models/student');
const Attendance = require('./models/attendance');
const User = require('./models/user');

// Import authentication middleware
const { requireAuth, requireAdmin, requireTeacher, userToViews } = require('./middleware/auth');

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
        let classCount, studentCount, attendanceCount;
        
        if (req.user.ROLE === 'admin') {
            // Admin sees all data
            classCount = await Class.countDocuments();
            studentCount = await Student.countDocuments();
            attendanceCount = await Attendance.countDocuments();
        } else {
            // Teachers see only their data
            classCount = await Class.countDocuments({ CREATEDBY: req.user._id });
            const userClasses = await Class.find({ CREATEDBY: req.user._id }).select('_id');
            const classIds = userClasses.map(c => c._id);
            studentCount = await Student.countDocuments({ classId: { $in: classIds } });
            attendanceCount = await Attendance.countDocuments({ classId: { $in: classIds } });
        }
        
        res.render('dashboard', { 
            user: req.user,
            stats: {
                classes: classCount,
                students: studentCount,
                attendance: attendanceCount
            }
        });
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
        const { CLASSNAME, ROOMNO, SUBJECT } = req.body;
        const newClass = new Class({ 
            CLASSNAME, 
            ROOMNO, 
            SUBJECT,
            CREATEDBY: req.user._id
        });
        await newClass.save();
        res.redirect('/classlist');
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to create class.');
    }
});

// Fetch Class List with Optional Filters (GET)
app.get('/classlist', requireAuth, async (req, res) => {
    try {
        const { CLASSNAME, ROOMNO, SUBJECT } = req.query;

        const query = {};
        if (CLASSNAME) query.CLASSNAME = CLASSNAME;
        if (ROOMNO) query.ROOMNO = ROOMNO;
        if (SUBJECT) query.SUBJECT = SUBJECT;

        // If user is not admin, only show their classes
        if (req.user.ROLE !== 'admin') {
            query.CREATEDBY = req.user._id;
        }

        const classlist = await Class.find(query);

        if (!classlist.length) {
            return res.render('classlist.ejs', { classlist: [], message: 'No classes found.', user: req.user });
        }

        res.render('classlist.ejs', { classlist, message: null, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Fetch Class List Based on POST Form Submission
app.post('/classlist', requireAuth, async (req, res) => {
    try {
        const { CLASSNAME, ROOMNO, SUBJECT } = req.body;

        const query = {};
        if (CLASSNAME) query.CLASSNAME = CLASSNAME;
        if (ROOMNO) query.ROOMNO = ROOMNO;
        if (SUBJECT) query.SUBJECT = SUBJECT;

        // If user is not admin, only show their classes
        if (req.user.ROLE !== 'admin') {
            query.CREATEDBY = req.user._id;
        }

        const classlist = await Class.find(query);

        res.render('classlist.ejs', { classlist, message: null, user: req.user });
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

//class detail
app.get('/classdetail/:id', requireAuth, async (req,res)=>{
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
        res.render('classdetail.ejs', { 
            classDetail: foundClass, 
            students: students, 
            attendances: [],
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
app.post('/classdetail/:id/addstudent', requireAuth, requireTeacher, async (req, res) => {
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
app.post('/classdetail/:id/addbulkstudents', requireAuth, requireTeacher, async (req, res) => {
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
app.post('/classdetail/:classId/deletestudent/:studentId', requireAuth, requireTeacher, async (req, res) => {
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
app.get('/classdetail/:id/students', requireAuth, requireTeacher, async (req, res) => {
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
app.get('/classdetail/:id/student-registration', requireAuth, requireTeacher, async (req, res) => {
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
app.get('/classdetail/:id/attendance-mark', requireAuth, requireTeacher, async (req, res) => {
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
app.get('/classdetail/:classId/attendance-report', requireAuth, requireTeacher, async (req, res) => {
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
                classDetail: foundClass,
                students,
                attendances,
                absentStudents,
                totalLectures,
                totalStudents: students.length,
                selectedDate: date,
                user: req.user
            });
        } else {
            res.render('attendance-report.ejs', {
                classDetail: foundClass,
                students,
                attendances: [],
                absentStudents: [],
                totalLectures: 0,
                totalStudents: students.length,
                selectedDate: null,
                user: req.user
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Bulk Mark Attendance
app.post('/classdetail/:classId/markattendance-bulk', requireAuth, requireTeacher, async (req, res) => {
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

// Emergency admin creation route (hidden)
app.get('/emergency-admin-creation/:secret', async (req, res) => {
    try {
        const { secret } = req.params;
        
        // Check if the secret matches the emergency code
        if (secret !== process.env.EMERGENCY_SECRET || 'Abdullahuroojadilfatir231703') {
            return res.status(403).send('Access Denied');
        }
        
        // Check if any admin exists
        const existingAdmin = await User.findOne({ ROLE: 'admin' });
        if (existingAdmin) {
            return res.send('Admin already exists. No emergency admin needed.');
        }
        
        // Create emergency admin
        const emergencyAdmin = new User({
            USERNAME: 'ABDULLAH ANSARI UROOJ',
            EMAIL: 'abdullahansariurooj@gmail.com',
            PASSWORD: '9920867077@Adil',
            FULLNAME: 'ABDULLAH ANSARI UROOJ',
            ROLE: 'admin',
            ISACTIVE: true
        });
        
        await emergencyAdmin.save();
        
        res.send(`
            <html>
            <head><title>Emergency Admin Created</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h1 style="color: #d32f2f;">🚨 Emergency Admin Created</h1>
                    <p><strong>Username:</strong> ABDULLAH ANSARI UROOJ</p>
                    <p><strong>Password:</strong> 9920867077@Adil</p>
                    <p><strong>Email:</strong> abdullahansariurooj@gmail.com</p>
                    <hr style="margin: 20px 0;">
                    <h3>⚠️ Important Steps:</h3>
                    <ol>
                        <li>Login with these credentials</li>
                        <li>Change the password immediately</li>
                        <li>Create a proper admin user</li>
                        <li>Delete this emergency admin</li>
                    </ol>
                    <a href="/login" style="background: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
                </div>
            </body>
            </html>
        `);
        
    } catch (err) {
        console.error('Emergency admin creation error:', err);
        res.status(500).send('Error creating emergency admin');
    }
});

// Secret admin route
app.get('/9920867077@AdilAbullahaUroojFatir', requireAuth, requireAdmin, async (req, res) => {
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

// Admin Management Routes
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

// Emergency admin creation route (hidden) - exact URL match
app.get('/emergency-admin-creation...Abdullahuroojadilfatir231703', async (req, res) => {
    try {
        // Check if any admin exists
        const existingAdmin = await User.findOne({ ROLE: 'admin' });
        if (existingAdmin) {
            return res.send('Admin already exists. No emergency admin needed.');
        }
        
        // Create emergency admin
        const emergencyAdmin = new User({
            USERNAME: 'ABDULLAH ANSARI UROOJ',
            EMAIL: 'abdullahansariurooj@gmail.com',
            PASSWORD: '9920867077@Adil',
            FULLNAME: 'ABDULLAH ANSARI UROOJ',
            ROLE: 'admin',
            ISACTIVE: true
        });
        
        await emergencyAdmin.save();
        
        res.send(`
            <html>
            <head><title>Emergency Admin Created</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h1 style="color: #d32f2f;">🚨 Emergency Admin Created</h1>
                    <p><strong>Username:</strong> ABDULLAH ANSARI UROOJ</p>
                    <p><strong>Password:</strong> 9920867077@Adil</p>
                    <p><strong>Email:</strong> abdullahansariurooj@gmail.com</p>
                    <hr style="margin: 20px 0;">
                    <h3>⚠️ Important Steps:</h3>
                    <ol>
                        <li>Login with these credentials</li>
                        <li>Change the password immediately</li>
                        <li>Create a proper admin user</li>
                        <li>Delete this emergency admin</li>
                    </ol>
                    <a href="/login" style="background: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
                </div>
            </body>
            </html>
        `);
        
    } catch (err) {
        console.error('Emergency admin creation error:', err);
        res.status(500).send('Error creating emergency admin');
    }
});

// No admin access page - completely hidden

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
