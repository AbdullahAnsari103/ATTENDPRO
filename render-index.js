// Render-specific AttendPro Application
// This version includes better error handling for Render deployment

const express = require('express');
const path = require('path');

// Initialize Express app first
const app = express();

// Basic middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Environment configuration with defaults
const config = {
    NODE_ENV: process.env.NODE_ENV || 'production',
    PORT: process.env.PORT || 3000,
    MONGODB_URI: process.env.MONGODB_URI || null,
    SESSION_SECRET: process.env.SESSION_SECRET || 'fallback-secret-for-testing',
    BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
    TRUST_PROXY: process.env.TRUST_PROXY === 'true',
    FORCE_HTTPS: process.env.FORCE_HTTPS === 'true'
};

// Trust proxy for Render
if (config.TRUST_PROXY) {
    app.set('trust proxy', 1);
}

// Health check endpoint (Render requirement)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        mongodb: config.MONGODB_URI ? 'configured' : 'not_configured'
    });
});

// Basic session setup (without MongoDB for initial testing)
const session = require('express-session');
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production' && config.FORCE_HTTPS,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database connection with better error handling
let dbConnected = false;

const connectDatabase = async () => {
    if (!config.MONGODB_URI) {
        console.log('⚠️  MongoDB URI not configured. Running in demo mode.');
        return false;
    }

    try {
        const mongoose = require('mongoose');
        
        await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully');
        dbConnected = true;
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Continuing without database (demo mode)');
        return false;
    }
};

// Initialize models only if database is connected
let User, Class, Student, Attendance;

const initializeModels = () => {
    if (dbConnected) {
        try {
            User = require('./models/user');
            Class = require('./models/class');
            Student = require('./models/student');
            Attendance = require('./models/attendance');
            console.log('✅ Models initialized');
        } catch (error) {
            console.error('❌ Model initialization failed:', error.message);
        }
    }
};

// Simple auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Demo data for when database is not available
const demoUser = {
    _id: 'demo-admin',
    USERNAME: 'admin',
    EMAIL: 'admin@attendpro.demo',
    FULLNAME: 'Demo Administrator',
    ROLE: 'admin'
};

// Routes
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('index', { 
        message: config.MONGODB_URI ? null : 'Demo Mode: Database not configured' 
    });
});

app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { 
        message: null, 
        messageType: null,
        demoMode: !config.MONGODB_URI
    });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        let user = null;
        
        if (dbConnected && User) {
            // Try database authentication
            user = await User.findOne({ 
                USERNAME: { $regex: new RegExp(`^${username}$`, 'i') } 
            });
            
            if (user) {
                const bcrypt = require('bcryptjs');
                const isValid = await bcrypt.compare(password, user.PASSWORD);
                if (!isValid) {
                    user = null;
                }
            }
        }
        
        // Fallback to emergency/demo credentials
        if (!user && (
            (username.toLowerCase() === 'admin' && password === 'AttendPro2024!') ||
            (username.toLowerCase() === process.env.EMERGENCY_ADMIN_USERNAME && 
             password === process.env.EMERGENCY_ADMIN_PASSWORD)
        )) {
            user = demoUser;
        }
        
        if (user) {
            req.session.userId = user._id;
            req.session.userRole = user.ROLE;
            req.session.userFullName = user.FULLNAME;
            
            console.log(`✅ Login successful: ${user.USERNAME}`);
            return res.redirect('/dashboard');
        } else {
            res.render('login', { 
                message: 'Invalid credentials', 
                messageType: 'error',
                demoMode: !config.MONGODB_URI
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { 
            message: 'Login failed. Please try again.', 
            messageType: 'error',
            demoMode: !config.MONGODB_URI
        });
    }
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard', {
        user: {
            FULLNAME: req.session.userFullName || 'Demo User',
            ROLE: req.session.userRole || 'admin'
        },
        demoMode: !dbConnected,
        stats: {
            totalClasses: dbConnected ? 'Loading...' : '0 (Demo)',
            totalStudents: dbConnected ? 'Loading...' : '0 (Demo)',
            todayAttendance: dbConnected ? 'Loading...' : '0 (Demo)'
        }
    });
});

// Student portal
app.get('/student-portal', (req, res) => {
    res.render('student-portal', { 
        message: null,
        demoMode: !dbConnected
    });
});

// Admin panel with obfuscated URL
app.get('/admin-panel9920867077@AdilAbullahaUroojFatir', requireAuth, (req, res) => {
    res.render('admin-panel', {
        user: {
            FULLNAME: req.session.userFullName || 'Demo Admin',
            ROLE: req.session.userRole || 'admin'
        },
        demoMode: !dbConnected,
        systemInfo: {
            nodeEnv: config.NODE_ENV,
            mongoConnected: dbConnected,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// Error handling
app.use((req, res) => {
    res.status(404).render('404', { 
        message: 'Page not found',
        demoMode: !dbConnected
    });
});

app.use((error, req, res, next) => {
    console.error('Application error:', error);
    res.status(500).render('error', { 
        message: config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        demoMode: !dbConnected
    });
});

// Server startup
const startServer = async () => {
    console.log('🚀 Starting AttendPro Application');
    console.log('================================');
    
    // Try to connect to database
    await connectDatabase();
    initializeModels();
    
    // Start server
    const server = app.listen(config.PORT, '0.0.0.0', () => {
        console.log('✅ Server Configuration:');
        console.log(`   • Environment: ${config.NODE_ENV}`);
        console.log(`   • Port: ${config.PORT}`);
        console.log(`   • Database: ${dbConnected ? 'Connected' : 'Demo Mode'}`);
        console.log(`   • Base URL: ${config.BASE_URL}`);
        console.log('');
        console.log('🌐 Server is running!');
        console.log(`   • Main App: ${config.BASE_URL}`);
        console.log(`   • Health Check: ${config.BASE_URL}/health`);
        console.log(`   • Student Portal: ${config.BASE_URL}/student-portal`);
        if (!dbConnected) {
            console.log('');
            console.log('⚠️  Demo Mode Active:');
            console.log('   • Login: admin / AttendPro2024!');
            console.log('   • Add MONGODB_URI environment variable for full functionality');
        }
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('🛑 Received SIGTERM, shutting down gracefully');
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });
};

// Start the application
startServer().catch((error) => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
});

module.exports = app;
