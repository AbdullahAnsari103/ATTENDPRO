// Production-ready AttendPro Application
// Import core dependencies
const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Import configuration and utilities
const { initializeEnvironment } = require('./config/environment');
const { connectDatabase, createOptimizedIndexes, performMaintenance } = require('./config/database');
const { setupSecurity } = require('./config/security');
const { logger, requestLogger, logAuthEvent, logAdminAction } = require('./utils/logger');

// Import middleware
const { 
    getEnhancedSessionConfig, 
    requireAuth, 
    requireAdmin, 
    requireTeacher, 
    hasClassAccess, 
    hasClassManagementAccess, 
    userToViews,
    sanitizeInputs
} = require('./middleware/auth-enhanced');

const {
    validateRegistration,
    validateLogin,
    validateClass,
    validateStudent,
    validateRollNumber,
    validateClassCode,
    sanitizeBody
} = require('./middleware/validation');

const {
    globalErrorHandler,
    notFoundHandler,
    timeoutHandler,
    gracefulShutdown,
    asyncErrorHandler
} = require('./middleware/error-handler');

// Import models
const Class = require('./models/class');
const Student = require('./models/student');
const Attendance = require('./models/attendance');
const User = require('./models/user');
const Timetable = require('./models/timetable');

// Import QR Code library
const QRCode = require('qrcode');

// Initialize environment configuration
const config = initializeEnvironment();

// Initialize Express app
const app = express();

// Trust proxy in production
if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Security middleware - MUST be first
setupSecurity(app);

// Compression middleware
if (config.ENABLE_COMPRESSION) {
    app.use(compression({
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        },
        level: config.NODE_ENV === 'production' ? 6 : 1
    }));
}

// CORS configuration
if (config.ENABLE_CORS) {
    app.use(cors({
        origin: config.NODE_ENV === 'production' ? config.BASE_URL : '*',
        credentials: true,
        optionsSuccessStatus: 200
    }));
}

// Request timeout middleware
app.use(timeoutHandler(30000)); // 30 second timeout

// Request logging middleware
app.use(requestLogger);

// Body parsing middleware with limits
app.use(express.json({ 
    limit: config.MAX_REQUEST_SIZE,
    type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: config.MAX_REQUEST_SIZE,
    parameterLimit: 50
}));

// Input sanitization
app.use(sanitizeInputs);
app.use(sanitizeBody);

// Static files with caching
const staticOptions = config.CACHE_STATIC_FILES ? {
    maxAge: config.NODE_ENV === 'production' ? '7d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        }
        if (path.match(/\.(jpg|jpeg|png|gif|svg|ico)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
        }
    }
} : {};

app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// View engine configuration
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Enhanced session configuration
const sessionConfig = {
    ...getEnhancedSessionConfig(),
    store: config.NODE_ENV === 'production' ? MongoStore.create({
        mongoUrl: config.MONGODB_URI,
        touchAfter: 24 * 3600, // Lazy session update
        ttl: 24 * 60 * 60, // 1 day session TTL
        autoRemove: 'native'
    }) : undefined
};

app.use(session(sessionConfig));

// Make user and config available to all views
app.use(userToViews);
app.use((req, res, next) => {
    res.locals.config = {
        NODE_ENV: config.NODE_ENV,
        ENABLE_REGISTRATION: config.ENABLE_REGISTRATION,
        ENABLE_QR_CODE_GENERATION: config.ENABLE_QR_CODE_GENERATION,
        BASE_URL: config.BASE_URL
    };
    next();
});

// Database connection and initialization
const initializeDatabase = async () => {
    try {
        await connectDatabase();
        
        // Create optimized indexes
        if (config.NODE_ENV === 'production') {
            await createOptimizedIndexes();
        }
        
        // Setup database maintenance if enabled
        if (config.DB_MAINTENANCE_ENABLED) {
            setInterval(performMaintenance, config.DB_MAINTENANCE_INTERVAL);
        }
        
        logger.info('✅ Database initialization completed');
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
};

// ======================  ROUTES  ====================== //

// Home Page (redirect to dashboard if logged in)
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('index');
});

// Login routes
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { message: null, messageType: null });
});

app.post('/login', validateLogin, asyncErrorHandler(async (req, res) => {
    const { username, password } = req.body;
    
    // Find user by username or email
    const user = await User.findOne({
        $or: [
            { USERNAME: username },
            { EMAIL: username }
        ]
    });
    
    if (!user || !user.ISACTIVE) {
        logAuthEvent('LOGIN', null, username, false, req, { reason: 'user_not_found_or_inactive' });
        return res.render('login', { 
            message: 'Invalid username/email or password', 
            messageType: 'error' 
        });
    }
    
    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
        logAuthEvent('LOGIN', user._id, user.USERNAME, false, req, { reason: 'invalid_password' });
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
    
    // Log successful authentication
    logAuthEvent('LOGIN', user._id, user.USERNAME, true, req);
    
    res.redirect('/dashboard');
}));

// Registration routes (if enabled)
app.get('/register', (req, res) => {
    if (!config.ENABLE_REGISTRATION) {
        return res.status(404).render('error', {
            message: 'Registration is currently disabled',
            user: null
        });
    }
    
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('register', { message: null, messageType: null });
});

app.post('/register', validateRegistration, asyncErrorHandler(async (req, res) => {
    if (!config.ENABLE_REGISTRATION) {
        return res.status(403).json({ error: 'Registration is disabled' });
    }
    
    const { USERNAME, EMAIL, PASSWORD, FULLNAME, ROLE } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
        $or: [{ USERNAME }, { EMAIL }]
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
            message: 'Only teachers can register through this form.', 
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
    
    logger.info('✅ New teacher registered:', {
        userId: newUser._id,
        username: newUser.USERNAME,
        email: newUser.EMAIL
    });
    
    res.render('login', { 
        message: 'Registration successful! Please login.', 
        messageType: 'success' 
    });
}));

// Logout
app.get('/logout', (req, res) => {
    const userId = req.session.userId;
    const userRole = req.session.userRole;
    
    req.session.destroy(() => {
        logger.info('✅ User logged out:', { userId, userRole });
        res.redirect('/login');
    });
});

// Dashboard (protected route)
app.get('/dashboard', requireAuth, asyncErrorHandler(async (req, res) => {
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
}));

// Class management routes
app.get('/createclass', requireAuth, requireTeacher, (req, res) => {
    res.render('createclass', { user: req.user });
});

app.post('/createclass', requireAuth, requireTeacher, validateClass, asyncErrorHandler(async (req, res) => {
    const { CLASSNAME, ROOMNO, SUBJECT, DESCRIPTION } = req.body;
    
    const newClass = new Class({ 
        CLASSNAME, 
        ROOMNO, 
        SUBJECT,
        DESCRIPTION: DESCRIPTION || '',
        CREATEDBY: req.user._id,
        ISACTIVE: true
    });
    
    await newClass.save();
    
    logger.info('✅ New class created:', {
        classId: newClass._id,
        className: newClass.CLASSNAME,
        classCode: newClass.CLASSCODE,
        createdBy: req.user.USERNAME
    });
    
    res.redirect('/classlist');
}));

// Class list and management
app.get('/classlist', requireAuth, requireTeacher, asyncErrorHandler(async (req, res) => {
    const { CLASSNAME, ROOMNO, SUBJECT } = req.query;

    const query = {};
    if (CLASSNAME) query.CLASSNAME = new RegExp(CLASSNAME, 'i');
    if (ROOMNO) query.ROOMNO = ROOMNO;
    if (SUBJECT) query.SUBJECT = new RegExp(SUBJECT, 'i');

    // If user is not admin, only show classes where they are a teacher
    if (req.user.ROLE !== 'admin') {
        query.TEACHERS = req.user._id;
    }

    const classlist = await Class.find(query)
        .populate('TEACHERS', 'FULLNAME EMAIL')
        .populate('CREATEDBY', 'FULLNAME EMAIL')
        .sort({ createdAt: -1 });

    // Add student count for each class
    const classesWithStudentCount = await Promise.all(classlist.map(async (classItem) => {
        const studentCount = await Student.countDocuments({ classId: classItem._id });
        return {
            ...classItem.toObject(),
            studentCount: studentCount
        };
    }));

    res.render('classlist', { 
        classes: classesWithStudentCount, 
        message: classesWithStudentCount.length === 0 ? 'No classes found.' : null, 
        user: req.user 
    });
}));

// Class detail view
app.get('/classdetail/:id', requireAuth, hasClassAccess, asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const foundClass = req.classDoc; // From hasClassAccess middleware
    const { joined } = req.query;
    
    const students = await Student.find({ classId: id }).sort({ ROLLNO: 1 });
    
    // Populate teachers for display
    await foundClass.populate('TEACHERS', 'FULLNAME EMAIL');
    
    res.render('classdetail', { 
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
}));

// Student management
app.post('/classdetail/:id/addstudent', requireAuth, hasClassManagementAccess, validateStudent, asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { NAME, ROLLNO } = req.body;
    
    // Check if class exists and user has access
    const foundClass = await Class.findById(id);
    if (!foundClass) {
        return res.json({ success: false, message: 'Class not found.' });
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
    
    logger.info('✅ Student added to class:', {
        studentId: newStudent._id,
        studentName: newStudent.NAME,
        rollNo: newStudent.ROLLNO,
        classId: id,
        addedBy: req.user.USERNAME
    });
    
    res.json({ 
        success: true, 
        student: newStudent,
        message: 'Student added successfully!' 
    });
}));

// Admin routes (secured with obfuscated URL)
app.get('/admin-panel9920867077@AdilAbullahaUroojFatir', requireAuth, requireAdmin, asyncErrorHandler(async (req, res) => {
    // Log admin access
    logAdminAction('ADMIN_PANEL_ACCESS', { path: req.path }, req);
    
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
        logger.warn(`⚠️  Multiple admins detected (${adminUsers.length}). Cleaning up...`);
        const adminToKeep = adminUsers[0];
        await User.deleteMany({ ROLE: 'admin', _id: { $ne: adminToKeep._id } });
        logger.info(`✅ Kept admin: ${adminToKeep.USERNAME}`);
    }

    // Fetch system statistics
    const [totalUsers, totalClasses, totalStudents, totalAttendance] = await Promise.all([
        User.countDocuments(),
        Class.countDocuments(),
        Student.countDocuments(),
        Attendance.countDocuments()
    ]);

    // Fetch recent data for admin panel
    const [users, allClasses, allStudents, allAttendance] = await Promise.all([
        User.find().select('-PASSWORD').sort({ CREATEDAT: -1 }).limit(5),
        Class.find().populate('CREATEDBY', 'FULLNAME USERNAME').sort({ createdAt: -1 }).limit(5),
        Student.find().populate('classId', 'CLASSNAME').sort({ createdAt: -1 }).limit(5),
        Attendance.find()
            .populate('studentId', 'NAME ROLLNO')
            .populate('classId', 'CLASSNAME')
            .sort({ date: -1 })
            .limit(10)
    ]);

    // Calculate recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [recentUsers, recentClasses, recentStudents, recentAttendance] = await Promise.all([
        User.countDocuments({ CREATEDAT: { $gte: sevenDaysAgo } }),
        Class.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Student.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Attendance.countDocuments({ date: { $gte: sevenDaysAgo } })
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
        process: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            version: process.version
        }
    });
}));

// Student portal routes
app.get('/student-portal', asyncErrorHandler(async (req, res) => {
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
        
        // Generate QR code for student portal access
        const studentPortalUrl = `${config.BASE_URL}/student-portal?rollno=${student.ROLLNO}`;
        let qrCodeDataUrl = null;
        
        if (config.ENABLE_QR_CODE_GENERATION) {
            qrCodeDataUrl = await QRCode.toDataURL(studentPortalUrl, {
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
        }
        
        return res.render('student-dashboard', {
            student: student,
            classDetail: student.classId,
            attendanceHistory: attendanceRecords,
            attendancePercentage: attendancePercentage,
            presentDays: presentDays,
            totalDays: totalDays,
            qrCode: qrCodeDataUrl,
            portalUrl: studentPortalUrl
        });
    }
    
    res.render('student-portal', { message: null, messageType: null, rollno: null });
}));

app.post('/student-portal', validateRollNumber, asyncErrorHandler(async (req, res) => {
    const { rollno } = req.body;
    
    // Find student by roll number
    const student = await Student.findOne({ ROLLNO: rollno }).populate('classId');
    
    if (!student) {
        return res.render('student-portal', { 
            message: 'Student not found. Please check your roll number.', 
            messageType: 'error',
            rollno: rollno
        });
    }
    
    // Redirect to GET route with rollno parameter
    res.redirect(`/student-portal?rollno=${rollno}`);
}));

// Health check endpoint for monitoring
app.get('/health', asyncErrorHandler(async (req, res) => {
    const { checkDatabaseHealth } = require('./config/database');
    const dbHealth = await checkDatabaseHealth();
    
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth,
        memory: process.memoryUsage(),
        version: require('./package.json').version
    };
    
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
}));

// API routes prefix
app.use('/api/v1', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Server initialization
const startServer = async () => {
    try {
        // Initialize database
        await initializeDatabase();
        
        // Start server
        const server = app.listen(config.PORT, config.HOST, () => {
            logger.info(`🚀 AttendPro Server started successfully!`);
            logger.info(`📍 URL: ${config.BASE_URL}`);
            logger.info(`🌍 Environment: ${config.NODE_ENV}`);
            logger.info(`🔒 Security: ${config.SESSION_SECRET === 'dev-secret-change-in-production' ? 'Development' : 'Production'}`);
        });
        
        // Setup graceful shutdown
        gracefulShutdown(server);
        
        return server;
        
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server if this file is run directly
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
